import {
  AuditAction,
  type FeeInvoice,
  InvoiceStatus,
  InvoiceType,
  Prisma,
  StudentStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { config } from '../../config';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { buildWhere } from '../../shared/queryBuilder';
import { createAuditLog } from '../../utils/auditLog';
import { formatMajor } from '../../utils/money';
import { INVOICE_SELECT, INVOICE_SORT_FIELDS, INVOICE_WRITE_CHUNK } from './invoice.constant';
import type {
  IInvoiceCreate,
  IInvoiceGenerate,
  IInvoiceListQuery,
  IInvoiceWaive,
  IMyInvoiceQuery,
} from './invoice.interface';

const INVOICE_SEQUENCE_PAD = 6;

const nextSequence = (latest: string | null, prefix: string): number => {
  if (latest === null || !latest.startsWith(prefix)) {
    return 1;
  }
  const raw = latest.slice(prefix.length);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
};

const generateInvoiceNumber = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> => {
  const numbers = await allocateInvoiceNumbers(tx, year, 1);
  const first = numbers[0];
  if (first === undefined) {
    throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to allocate an invoice number');
  }
  return first;
};

const allocateInvoiceNumbers = async (
  tx: Prisma.TransactionClient,
  year: number,
  count: number,
): Promise<string[]> => {
  if (count <= 0) {
    return [];
  }
  const lockKey = `invoice-number:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const prefix = `INV-${year}-`;
  const latest = await tx.feeInvoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });

  let sequence = nextSequence(latest?.invoiceNumber ?? null, prefix);
  const numbers: string[] = [];
  for (let index = 0; index < count; index += 1) {
    numbers.push(`${prefix}${String(sequence).padStart(INVOICE_SEQUENCE_PAD, '0')}`);
    sequence += 1;
  }
  return numbers;
};

const invoiceStatusFor = (
  totalAmount: Prisma.Decimal,
  paidAmount: Prisma.Decimal,
): InvoiceStatus => {
  if (paidAmount.gte(totalAmount) && totalAmount.gte(0)) {
    return InvoiceStatus.PAID;
  }
  if (paidAmount.gt(0)) {
    return InvoiceStatus.PARTIAL;
  }
  return InvoiceStatus.UNPAID;
};

const uniqueConstraint = (error: unknown): string | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return null;
  }
  const target = error.meta?.['target'];
  if (Array.isArray(target)) {
    return target.map(String).join(',');
  }
  if (typeof target === 'string') {
    return target;
  }
  return 'field';
};

const serializeInvoice = <
  T extends {
    totalAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    dueDate: Date;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  row: T,
) => ({
  ...row,
  totalAmount: formatMajor(row.totalAmount),
  paidAmount: formatMajor(row.paidAmount),
  outstanding: formatMajor(
    row.totalAmount.sub(row.paidAmount).lt(0)
      ? new Prisma.Decimal(0)
      : row.totalAmount.sub(row.paidAmount),
  ),
  dueDate: row.dueDate.toISOString(),
  paidAt: row.paidAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const requireInvoice = async (id: string) => {
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id, deletedAt: null },
    select: INVOICE_SELECT,
  });
  if (invoice === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Invoice not found');
  }
  return invoice;
};

export async function getBlockingDues(
  tx: Prisma.TransactionClient,
  studentId: string,
  currentSemesterId: string,
): Promise<FeeInvoice[]> {
  return tx.feeInvoice.findMany({
    where: {
      studentId,
      deletedAt: null,
      semesterId: { not: currentSemesterId },
      status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
      dueDate: { lt: new Date() },
    },
  });
}

export async function adjustSemesterInvoice(
  tx: Prisma.TransactionClient,
  studentId: string,
  semesterId: string,
  creditDelta: Prisma.Decimal,
  feePerCredit: Prisma.Decimal,
): Promise<void> {
  if (creditDelta.isZero()) {
    return;
  }

  const amountDelta = creditDelta.mul(feePerCredit);
  const existing = await tx.feeInvoice.findFirst({
    where: {
      studentId,
      semesterId,
      type: InvoiceType.TUITION,
      deletedAt: null,
    },
  });

  if (existing === null) {
    if (amountDelta.lte(0)) {
      return;
    }
    const semester = await tx.semester.findFirst({
      where: { id: semesterId },
      select: { year: true, registrationEnd: true },
    });
    if (semester === null) {
      return;
    }
    await tx.feeInvoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(tx, semester.year),
        studentId,
        semesterId,
        type: InvoiceType.TUITION,
        status: InvoiceStatus.UNPAID,
        totalAmount: amountDelta,
        paidAmount: new Prisma.Decimal(0),
        dueDate: semester.registrationEnd,
      },
    });
    return;
  }

  const nextTotal = existing.totalAmount.add(amountDelta);
  const totalAmount = nextTotal.lt(0) ? new Prisma.Decimal(0) : nextTotal;
  const status = invoiceStatusFor(totalAmount, existing.paidAmount);
  const overpaid = existing.paidAmount.gt(totalAmount);
  const overpaymentNote = overpaid
    ? `Overpayment of ${formatMajor(existing.paidAmount.sub(totalAmount))} after enrollment change; admin refund required.`
    : null;

  // If paidAmount now exceeds totalAmount, leave the overpayment in place and
  // mark PAID. Refunds are the payment module's concern.
  await tx.feeInvoice.update({
    where: { id: existing.id },
    data: {
      totalAmount,
      status,
      ...(overpaymentNote !== null
        ? {
            notes: [existing.notes, overpaymentNote]
              .filter((value) => value !== null && value.length > 0)
              .join(' '),
          }
        : {}),
    },
  });
}

const listMine = async (studentId: string, query: IMyInvoiceQuery) => {
  const pagination = paginate(query, INVOICE_SORT_FIELDS);
  const where = buildWhere({
    searchFields: [],
    filters: {
      studentId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.semesterId !== undefined ? { semesterId: query.semesterId } : {}),
    },
  }) as Prisma.FeeInvoiceWhereInput;

  const [rows, total] = await prisma.$transaction([
    prisma.feeInvoice.findMany({
      where,
      select: INVOICE_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.feeInvoice.count({ where }),
  ]);

  return {
    data: rows.map(serializeInvoice),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const getById = async (id: string) => serializeInvoice(await requireInvoice(id));

const listAll = async (query: IInvoiceListQuery) => {
  const pagination = paginate(query, INVOICE_SORT_FIELDS);
  const where = buildWhere({
    search: query.search,
    searchFields: ['invoiceNumber'],
    filters: {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.semesterId !== undefined ? { semesterId: query.semesterId } : {}),
      ...(query.studentId !== undefined ? { studentId: query.studentId } : {}),
      ...(query.type !== undefined ? { type: query.type } : {}),
    },
  }) as Prisma.FeeInvoiceWhereInput;

  const [rows, total] = await prisma.$transaction([
    prisma.feeInvoice.findMany({
      where,
      select: {
        ...INVOICE_SELECT,
        student: {
          select: {
            studentId: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        semester: { select: { name: true } },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.feeInvoice.count({ where }),
  ]);

  return {
    data: rows.map((row) => ({
      ...serializeInvoice(row),
      student: row.student,
      semester: row.semester,
    })),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const create = async (actorId: string, input: IInvoiceCreate) => {
  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'dueDate must be a valid date');
  }
  if (dueDate.getTime() <= Date.now()) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'dueDate must be in the future');
  }

  const [student, semester] = await Promise.all([
    prisma.studentProfile.findFirst({
      where: { id: input.studentId, deletedAt: null },
      select: { id: true },
    }),
    prisma.semester.findFirst({
      where: { id: input.semesterId, deletedAt: null },
      select: { id: true, year: true },
    }),
  ]);
  if (student === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student not found');
  }
  if (semester === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
  }

  const totalAmount = new Prisma.Decimal(input.totalAmount);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const invoice = await tx.feeInvoice.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(tx, semester.year),
          studentId: input.studentId,
          semesterId: input.semesterId,
          type: input.type,
          status: InvoiceStatus.UNPAID,
          totalAmount,
          paidAmount: new Prisma.Decimal(0),
          currency: config.DEFAULT_CURRENCY,
          dueDate,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        select: INVOICE_SELECT,
      });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'FeeInvoice',
        entityId: invoice.id,
        after: {
          invoiceNumber: invoice.invoiceNumber,
          type: invoice.type,
          totalAmount: formatMajor(invoice.totalAmount),
        },
      });
      return invoice;
    });
    return serializeInvoice(created);
  } catch (error) {
    const constraint = uniqueConstraint(error);
    if (constraint !== null) {
      const normalized = constraint.toLowerCase();
      if (normalized.includes('invoice_number') || normalized.includes('invoicenumber')) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          'Could not allocate a unique invoice number; retry',
        );
      }
      throw new ApiError(
        StatusCodes.CONFLICT,
        `A ${input.type} invoice already exists for this student in this semester`,
      );
    }
    throw error;
  }
};

const generateRegistrationInvoices = async (actorId: string, input: IInvoiceGenerate) => {
  const semester = await prisma.semester.findFirst({
    where: { id: input.semesterId, deletedAt: null },
    select: { id: true, year: true, name: true, registrationEnd: true },
  });
  if (semester === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Semester not found');
  }

  const existing = await prisma.feeInvoice.findMany({
    where: { semesterId: semester.id, type: InvoiceType.REGISTRATION, deletedAt: null },
    select: { studentId: true },
  });
  const alreadyBilled = new Set(existing.map((row) => row.studentId));

  let created = 0;
  let skipped = alreadyBilled.size;
  let cursor: string | undefined;

  for (;;) {
    const students = await prisma.studentProfile.findMany({
      where: { deletedAt: null, status: StudentStatus.ACTIVE },
      select: { id: true, program: { select: { registrationFee: true } } },
      orderBy: { id: 'asc' },
      take: INVOICE_WRITE_CHUNK,
      ...(cursor !== undefined ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (students.length === 0) {
      break;
    }
    cursor = students[students.length - 1]?.id;

    const pending = students.filter((row) => !alreadyBilled.has(row.id));
    skipped += students.length - pending.length;
    if (pending.length === 0) {
      continue;
    }

    const inserted = await prisma.$transaction(async (tx) => {
      const numbers = await allocateInvoiceNumbers(tx, semester.year, pending.length);
      const data = pending.map((student, index) => ({
        invoiceNumber: numbers[index] ?? `INV-${semester.year}-PENDING`,
        studentId: student.id,
        semesterId: semester.id,
        type: InvoiceType.REGISTRATION,
        status: InvoiceStatus.UNPAID,
        totalAmount: student.program.registrationFee,
        paidAmount: new Prisma.Decimal(0),
        currency: config.DEFAULT_CURRENCY,
        dueDate: semester.registrationEnd,
      }));
      const result = await tx.feeInvoice.createMany({ data, skipDuplicates: true });
      await createAuditLog(tx, {
        actorId,
        action: AuditAction.CREATE,
        entity: 'FeeInvoice',
        entityId: semester.id,
        after: { type: InvoiceType.REGISTRATION, created: result.count, semester: semester.name },
      });
      return result.count;
    });
    created += inserted;
    skipped += pending.length - inserted;
    for (const student of pending) {
      alreadyBilled.add(student.id);
    }
  }

  return { created, skipped, semesterId: semester.id, semester: semester.name };
};

const waive = async (actorId: string, id: string, input: IInvoiceWaive) => {
  const invoice = await requireInvoice(id);
  if (invoice.status !== InvoiceStatus.UNPAID && invoice.status !== InvoiceStatus.PARTIAL) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot waive an invoice with status ${invoice.status}`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.feeInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.WAIVED, notes: input.reason },
      select: INVOICE_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'FeeInvoice',
      entityId: id,
      before: { status: invoice.status, notes: invoice.notes },
      after: { status: InvoiceStatus.WAIVED, reason: input.reason },
    });
    return row;
  });
  return serializeInvoice(updated);
};

const cancel = async (actorId: string, id: string) => {
  const invoice = await requireInvoice(id);
  if (invoice.status === InvoiceStatus.CANCELLED) {
    throw new ApiError(StatusCodes.CONFLICT, 'Invoice is already cancelled');
  }
  if (invoice.paidAmount.gt(0)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot cancel an invoice with ${formatMajor(invoice.paidAmount)} already paid`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.feeInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      select: INVOICE_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'FeeInvoice',
      entityId: id,
      before: { status: invoice.status },
      after: { status: InvoiceStatus.CANCELLED },
    });
    return row;
  });
  return serializeInvoice(updated);
};

const summary = async () => {
  const now = new Date();
  const [collected, outstanding, overdue] = await Promise.all([
    prisma.feeInvoice.aggregate({
      where: { deletedAt: null, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { paidAmount: true },
    }),
    prisma.feeInvoice.aggregate({
      where: {
        deletedAt: null,
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
      },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.feeInvoice.aggregate({
      where: {
        deletedAt: null,
        status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL] },
        dueDate: { lt: now },
      },
      _sum: { totalAmount: true, paidAmount: true },
    }),
  ]);

  const outstandingTotal = (outstanding._sum.totalAmount ?? new Prisma.Decimal(0)).sub(
    outstanding._sum.paidAmount ?? new Prisma.Decimal(0),
  );
  const overdueTotal = (overdue._sum.totalAmount ?? new Prisma.Decimal(0)).sub(
    overdue._sum.paidAmount ?? new Prisma.Decimal(0),
  );

  return {
    collected: formatMajor(collected._sum.paidAmount ?? new Prisma.Decimal(0)),
    outstanding: formatMajor(outstandingTotal.lt(0) ? new Prisma.Decimal(0) : outstandingTotal),
    overdue: formatMajor(overdueTotal.lt(0) ? new Prisma.Decimal(0) : overdueTotal),
  };
};

export const InvoiceService = {
  listMine,
  getById,
  listAll,
  create,
  generateRegistrationInvoices,
  waive,
  cancel,
  summary,
};
