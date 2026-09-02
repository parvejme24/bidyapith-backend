import { randomBytes } from 'node:crypto';
import {
  AuditAction,
  InvoiceStatus,
  NotificationType,
  PaymentGateway,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { config } from '../../config';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { createAuditLog } from '../../utils/auditLog';
import { formatMajor, toMinor } from '../../utils/money';
import { sendEmail } from '../../utils/sendEmail';
import { getPaymentGateway } from './gateway';
import type { GatewayEvent } from './gateway/gateway.interface';
import { INITIATE_LOCK_MS, PAYMENT_SELECT, PAYMENT_SORT_FIELDS } from './payment.constant';
import type { IMyPaymentQuery, IPaymentListQuery, IPaymentRefund } from './payment.interface';

const toJson = (value: unknown): Prisma.InputJsonValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return { unserializable: true };
  }
};

const storedRedirectUrl = (value: Prisma.JsonValue | null): string | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const url = value['redirectUrl'];
  return typeof url === 'string' && url.length > 0 ? url : null;
};

const serializePayment = <
  T extends {
    amount: Prisma.Decimal;
    initiatedAt: Date;
    paidAt: Date | null;
    refundedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  row: T,
) => ({
  ...row,
  amount: formatMajor(row.amount),
  initiatedAt: row.initiatedAt.toISOString(),
  paidAt: row.paidAt?.toISOString() ?? null,
  refundedAt: row.refundedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const configuredGateway = (): PaymentGateway =>
  config.PAYMENT_GATEWAY === 'SSLCOMMERZ' ? PaymentGateway.SSLCOMMERZ : PaymentGateway.STRIPE;

const makeTransactionRef = (): string => `PAY-${Date.now()}-${randomBytes(4).toString('hex')}`;

const payableStatuses: InvoiceStatus[] = [InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL];

const requirePayment = async (id: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    select: {
      ...PAYMENT_SELECT,
      invoice: {
        select: {
          id: true,
          studentId: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
        },
      },
    },
  });
  if (payment === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
  }
  return payment;
};

const initiate = async (studentId: string, invoiceId: string) => {
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: invoiceId, deletedAt: null },
    select: {
      id: true,
      studentId: true,
      status: true,
      totalAmount: true,
      paidAmount: true,
      currency: true,
      invoiceNumber: true,
      student: {
        select: {
          user: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (invoice === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Invoice not found');
  }
  if (invoice.studentId !== studentId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not your invoice');
  }
  if (!payableStatuses.includes(invoice.status)) {
    throw new ApiError(StatusCodes.CONFLICT, `Cannot pay an invoice with status ${invoice.status}`);
  }

  const outstanding = invoice.totalAmount.sub(invoice.paidAmount);
  if (outstanding.lte(0)) {
    throw new ApiError(StatusCodes.CONFLICT, 'Invoice has no outstanding balance');
  }

  const cutoff = new Date(Date.now() - INITIATE_LOCK_MS);
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-initiate:${invoiceId}`}))`;

    const recent = await tx.payment.findFirst({
      where: {
        invoiceId,
        status: PaymentStatus.INITIATED,
        initiatedAt: { gte: cutoff },
      },
      select: {
        id: true,
        transactionRef: true,
        gatewaySessionId: true,
        gatewayResponse: true,
      },
      orderBy: { initiatedAt: 'desc' },
    });
    if (recent !== null) {
      return { kind: 'existing' as const, payment: recent };
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        transactionRef: makeTransactionRef(),
        gateway: configuredGateway(),
        status: PaymentStatus.INITIATED,
        amount: outstanding,
        currency: invoice.currency,
      },
      select: PAYMENT_SELECT,
    });
    return { kind: 'new' as const, payment };
  });

  if (prepared.kind === 'existing') {
    const redirectUrl = storedRedirectUrl(prepared.payment.gatewayResponse);
    throw new ApiError(
      StatusCodes.CONFLICT,
      'A checkout session is already in progress for this invoice',
      [
        { path: 'transactionRef', message: prepared.payment.transactionRef },
        {
          path: 'redirectUrl',
          message: redirectUrl ?? 'Checkout is still being created; retry shortly',
        },
      ],
    );
  }

  const successUrl = `${config.PAYMENT_SUCCESS_URL}?transactionRef=${encodeURIComponent(prepared.payment.transactionRef)}`;
  const cancelUrl = `${config.PAYMENT_CANCEL_URL}?transactionRef=${encodeURIComponent(prepared.payment.transactionRef)}`;

  try {
    const session = await getPaymentGateway().createSession({
      transactionRef: prepared.payment.transactionRef,
      amountMinor: toMinor(prepared.payment.amount, prepared.payment.currency),
      currency: prepared.payment.currency,
      description: `Invoice ${invoice.invoiceNumber}`,
      customerEmail: invoice.student.user.email,
      successUrl,
      cancelUrl,
    });
    await prisma.payment.update({
      where: { id: prepared.payment.id },
      data: {
        gatewaySessionId: session.sessionId,
        gatewayResponse: { redirectUrl: session.redirectUrl },
      },
    });
    return {
      transactionRef: prepared.payment.transactionRef,
      redirectUrl: session.redirectUrl,
      amount: formatMajor(prepared.payment.amount),
      currency: prepared.payment.currency,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Payment gateway error';
    await prisma.payment.update({
      where: { id: prepared.payment.id },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });
    throw new ApiError(StatusCodes.BAD_GATEWAY, 'Payment gateway failed to create a session');
  }
};

const applyInvoiceCredit = async (
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amount: Prisma.Decimal,
): Promise<void> => {
  const value = amount.toFixed(2);
  await tx.$executeRaw`
    UPDATE fee_invoices
    SET
      paid_amount = paid_amount + ${value}::numeric,
      status = CASE
        WHEN paid_amount + ${value}::numeric >= total_amount THEN 'PAID'::"InvoiceStatus"
        ELSE 'PARTIAL'::"InvoiceStatus"
      END,
      paid_at = CASE
        WHEN paid_amount + ${value}::numeric >= total_amount THEN NOW()
        ELSE paid_at
      END,
      updated_at = NOW()
    WHERE id = ${invoiceId}::uuid AND deleted_at IS NULL
  `;
};

const applyInvoiceDebit = async (
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amount: Prisma.Decimal,
): Promise<void> => {
  const value = amount.toFixed(2);
  await tx.$executeRaw`
    UPDATE fee_invoices
    SET
      paid_amount = GREATEST(paid_amount - ${value}::numeric, 0),
      status = CASE
        WHEN GREATEST(paid_amount - ${value}::numeric, 0) <= 0 THEN 'UNPAID'::"InvoiceStatus"
        WHEN GREATEST(paid_amount - ${value}::numeric, 0) >= total_amount THEN 'PAID'::"InvoiceStatus"
        ELSE 'PARTIAL'::"InvoiceStatus"
      END,
      paid_at = CASE
        WHEN GREATEST(paid_amount - ${value}::numeric, 0) >= total_amount THEN paid_at
        ELSE NULL
      END,
      updated_at = NOW()
    WHERE id = ${invoiceId}::uuid AND deleted_at IS NULL
  `;
};

const notifyPaymentSuccess = (
  email: string,
  firstName: string,
  userId: string,
  invoiceNumber: string,
  amount: string,
  currency: string,
  transactionRef: string,
  paidAt: string,
): void => {
  void (async () => {
    try {
      await prisma.notification.create({
        data: {
          userId,
          type: NotificationType.PAYMENT,
          title: 'Payment received',
          body: `Payment of ${amount} ${currency} for ${invoiceNumber} was recorded.`,
          link: `/payments/verify/${transactionRef}`,
        },
      });
    } catch (error) {
      console.error('[payment] failed to insert payment notification', error);
    }
    void sendEmail({
      to: email,
      subject: `Receipt for ${invoiceNumber}`,
      template: 'paymentReceipt',
      data: { firstName, invoiceNumber, amount, currency, transactionRef, paidAt },
    });
  })();
};

const handleWebhook = async (event: GatewayEvent): Promise<{ handled: string }> => {
  if (event.transactionRef.length === 0) {
    return { handled: 'ignored' };
  }

  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { transactionRef: event.transactionRef },
      select: {
        id: true,
        invoiceId: true,
        amount: true,
        currency: true,
        status: true,
        gatewayTransactionId: true,
        transactionRef: true,
        invoice: {
          select: {
            invoiceNumber: true,
            student: {
              select: {
                userId: true,
                user: { select: { email: true, firstName: true } },
              },
            },
          },
        },
      },
    });

    if (payment === null) {
      console.error(`[payment] webhook for unknown transactionRef ${event.transactionRef}`);
      return { kind: 'missing' as const };
    }

    if (payment.gatewayTransactionId !== null) {
      return { kind: 'replay' as const };
    }

    const recordedMinor = toMinor(payment.amount, payment.currency);
    const currencyMatches = event.currency.toUpperCase() === payment.currency.toUpperCase();
    if (event.status === 'SUCCESS' && (event.amountMinor !== recordedMinor || !currencyMatches)) {
      console.error(
        `[payment] amount mismatch for ${payment.transactionRef}: gateway ${event.amountMinor} ${event.currency} vs recorded ${recordedMinor} ${payment.currency}`,
      );
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: `Amount mismatch: gateway ${event.amountMinor} ${event.currency}, recorded ${recordedMinor} ${payment.currency}`,
          gatewayTransactionId: event.gatewayTransactionId,
          gatewayResponse: toJson(event.raw),
        },
      });
      await createAuditLog(tx, {
        action: AuditAction.PAYMENT,
        entity: 'Payment',
        entityId: payment.id,
        after: { status: PaymentStatus.FAILED, reason: 'AMOUNT_MISMATCH' },
      });
      return { kind: 'mismatch' as const };
    }

    if (event.status === 'FAILED' || event.status === 'CANCELLED') {
      const status = event.status === 'CANCELLED' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED;
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status,
          failureReason: event.status,
          gatewayResponse: toJson(event.raw),
          ...(event.gatewayTransactionId.length > 0
            ? { gatewayTransactionId: event.gatewayTransactionId }
            : {}),
        },
      });
      await createAuditLog(tx, {
        action: AuditAction.PAYMENT,
        entity: 'Payment',
        entityId: payment.id,
        after: { status },
      });
      return { kind: 'closed' as const, status };
    }

    try {
      const claimed = await tx.payment.updateMany({
        where: {
          id: payment.id,
          gatewayTransactionId: null,
          status: PaymentStatus.INITIATED,
        },
        data: {
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
          gatewayTransactionId: event.gatewayTransactionId,
          gatewayResponse: toJson(event.raw),
          failureReason: null,
        },
      });
      if (claimed.count === 0) {
        return { kind: 'replay' as const };
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { kind: 'replay' as const };
      }
      throw error;
    }

    await applyInvoiceCredit(tx, payment.invoiceId, payment.amount);
    await createAuditLog(tx, {
      action: AuditAction.PAYMENT,
      entity: 'Payment',
      entityId: payment.id,
      after: {
        status: PaymentStatus.SUCCESS,
        amount: formatMajor(payment.amount),
        invoiceId: payment.invoiceId,
      },
    });

    return {
      kind: 'success' as const,
      email: payment.invoice.student.user.email,
      firstName: payment.invoice.student.user.firstName,
      userId: payment.invoice.student.userId,
      invoiceNumber: payment.invoice.invoiceNumber,
      amount: formatMajor(payment.amount),
      currency: payment.currency,
      transactionRef: payment.transactionRef,
    };
  });

  if (outcome.kind === 'success') {
    notifyPaymentSuccess(
      outcome.email,
      outcome.firstName,
      outcome.userId,
      outcome.invoiceNumber,
      outcome.amount,
      outcome.currency,
      outcome.transactionRef,
      new Date().toISOString(),
    );
  }

  return { handled: outcome.kind };
};

const verify = async (studentId: string, transactionRef: string) => {
  const payment = await prisma.payment.findUnique({
    where: { transactionRef },
    select: {
      ...PAYMENT_SELECT,
      invoice: {
        select: {
          id: true,
          studentId: true,
          invoiceNumber: true,
          status: true,
          totalAmount: true,
          paidAmount: true,
          currency: true,
        },
      },
    },
  });
  if (payment === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
  }
  if (payment.invoice.studentId !== studentId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Not your payment');
  }
  return {
    payment: serializePayment(payment),
    invoice: {
      id: payment.invoice.id,
      invoiceNumber: payment.invoice.invoiceNumber,
      status: payment.invoice.status,
      totalAmount: formatMajor(payment.invoice.totalAmount),
      paidAmount: formatMajor(payment.invoice.paidAmount),
      currency: payment.invoice.currency,
    },
  };
};

const listMine = async (studentId: string, query: IMyPaymentQuery) => {
  const pagination = paginate(query, PAYMENT_SORT_FIELDS);
  const where: Prisma.PaymentWhereInput = { invoice: { studentId, deletedAt: null } };
  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      select: {
        ...PAYMENT_SELECT,
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.payment.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({ ...serializePayment(row), invoice: row.invoice })),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const getById = async (id: string) => {
  const payment = await requirePayment(id);
  return serializePayment(payment);
};

const listAll = async (query: IPaymentListQuery) => {
  const pagination = paginate(query, PAYMENT_SORT_FIELDS);
  const paymentWhere: Prisma.PaymentWhereInput = {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.gateway !== undefined ? { gateway: query.gateway } : {}),
    ...(query.invoiceId !== undefined ? { invoiceId: query.invoiceId } : {}),
  };

  const [rows, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where: paymentWhere,
      select: {
        ...PAYMENT_SELECT,
        invoice: {
          select: {
            invoiceNumber: true,
            student: { select: { studentId: true } },
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.payment.count({ where: paymentWhere }),
  ]);

  return {
    data: rows.map((row) => ({
      ...serializePayment(row),
      invoiceNumber: row.invoice.invoiceNumber,
      studentId: row.invoice.student.studentId,
    })),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const refund = async (actorId: string, id: string, input: IPaymentRefund) => {
  const payment = await requirePayment(id);
  if (payment.status !== PaymentStatus.SUCCESS) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Only a SUCCESS payment may be refunded (current status ${payment.status})`,
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.payment.update({
      where: { id },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        failureReason: input.reason,
      },
      select: PAYMENT_SELECT,
    });
    await applyInvoiceDebit(tx, payment.invoiceId, payment.amount);
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.PAYMENT,
      entity: 'Payment',
      entityId: id,
      before: { status: PaymentStatus.SUCCESS },
      after: { status: PaymentStatus.REFUNDED, reason: input.reason },
    });
    return row;
  });

  return serializePayment(updated);
};

export const PaymentService = {
  initiate,
  handleWebhook,
  verify,
  listMine,
  getById,
  listAll,
  refund,
};
