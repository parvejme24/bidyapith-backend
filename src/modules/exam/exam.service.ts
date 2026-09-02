import { randomUUID } from 'node:crypto';
import {
  AuditAction,
  EnrollmentStatus,
  ExamType,
  Prisma,
  Role,
  SemesterStatus,
} from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { paginate, paginationMeta } from '../../shared/paginate';
import { prisma } from '../../shared/prisma';
import { createAuditLog } from '../../utils/auditLog';
import { EXAM_SORT_FIELDS, RESULT_SORT_FIELDS, WEIGHT_CAP } from './exam.constant';
import type {
  IExamCreate,
  IExamListQuery,
  IExamResultsWrite,
  IExamUpdate,
  IMyExamResultsQuery,
} from './exam.interface';

const marks = (value: Prisma.Decimal): string => value.toFixed(2);

const EXAM_SELECT = {
  id: true,
  offeringId: true,
  type: true,
  title: true,
  totalMarks: true,
  weight: true,
  examDate: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} as const;

const serializeExam = <
  T extends {
    totalMarks: Prisma.Decimal;
    weight: Prisma.Decimal;
    examDate: Date;
    createdAt: Date;
    updatedAt: Date;
  },
>(
  row: T,
) => ({
  ...row,
  totalMarks: marks(row.totalMarks),
  weight: marks(row.weight),
  examDate: row.examDate.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const requireLiveExam = async (id: string) => {
  const exam = await prisma.exam.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...EXAM_SELECT,
      offering: {
        select: {
          id: true,
          instructorId: true,
          semester: {
            select: {
              status: true,
              classStartDate: true,
              classEndDate: true,
            },
          },
        },
      },
    },
  });
  if (exam === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Exam not found');
  }
  return exam;
};

const requireOfferingForExam = async (offeringId: string) => {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: offeringId, deletedAt: null },
    select: {
      id: true,
      instructorId: true,
      semester: {
        select: {
          status: true,
          classStartDate: true,
          classEndDate: true,
        },
      },
    },
  });
  if (offering === null) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
  }
  return offering;
};

const assertSemesterAllowsExams = (status: SemesterStatus): void => {
  if (status !== SemesterStatus.ONGOING && status !== SemesterStatus.GRADING) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Exams can only be managed while the semester is ONGOING or GRADING (current status is ${status})`,
    );
  }
};

const assertExamDateInTerm = (examDate: Date, start: Date, end: Date): void => {
  if (examDate < start || examDate > end) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'examDate must fall between classStartDate and classEndDate',
    );
  }
};

const weightRemaining = (used: Prisma.Decimal): Prisma.Decimal => {
  const left = new Prisma.Decimal(WEIGHT_CAP).sub(used);
  return left.lt(0) ? new Prisma.Decimal(0) : left;
};

const upsertExamResults = async (
  tx: Prisma.TransactionClient,
  rows: {
    id: string;
    examId: string;
    enrollmentId: string;
    marksObtained: string;
    remarks: string;
    evaluatedById: string;
  }[],
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }
  await tx.$executeRaw`
    INSERT INTO exam_results (id, exam_id, enrollment_id, marks_obtained, remarks, evaluated_by_id, created_at, updated_at)
    SELECT
      u.id,
      u.exam_id,
      u.enrollment_id,
      u.marks_obtained::numeric,
      NULLIF(u.remarks, ''),
      u.evaluated_by_id,
      NOW(),
      NOW()
    FROM UNNEST(
      ${rows.map((row) => row.id)}::uuid[],
      ${rows.map((row) => row.examId)}::uuid[],
      ${rows.map((row) => row.enrollmentId)}::uuid[],
      ${rows.map((row) => row.marksObtained)}::text[],
      ${rows.map((row) => row.remarks)}::text[],
      ${rows.map((row) => row.evaluatedById)}::uuid[]
    ) AS u(id, exam_id, enrollment_id, marks_obtained, remarks, evaluated_by_id)
    ON CONFLICT (exam_id, enrollment_id)
    DO UPDATE SET
      marks_obtained = EXCLUDED.marks_obtained,
      remarks = EXCLUDED.remarks,
      evaluated_by_id = EXCLUDED.evaluated_by_id,
      updated_at = NOW()
  `;
};

const recomputeTotalMarks = async (
  tx: Prisma.TransactionClient,
  enrollmentIds: string[],
): Promise<void> => {
  if (enrollmentIds.length === 0) {
    return;
  }
  const rows = await tx.examResult.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      exam: { deletedAt: null },
    },
    select: {
      enrollmentId: true,
      marksObtained: true,
      exam: { select: { totalMarks: true, weight: true } },
    },
  });

  const totals = new Map<string, Prisma.Decimal>();
  for (const id of enrollmentIds) {
    totals.set(id, new Prisma.Decimal(0));
  }
  for (const row of rows) {
    if (row.exam.totalMarks.isZero()) {
      continue;
    }
    const contribution = row.marksObtained.div(row.exam.totalMarks).mul(row.exam.weight);
    totals.set(
      row.enrollmentId,
      (totals.get(row.enrollmentId) ?? new Prisma.Decimal(0)).add(contribution),
    );
  }

  const ids = [...totals.keys()];
  const values = ids.map((id) => (totals.get(id) ?? new Prisma.Decimal(0)).toFixed(2));
  await tx.$executeRaw`
    UPDATE enrollments AS e
    SET total_marks = v.total::numeric, updated_at = NOW()
    FROM UNNEST(
      ${ids}::uuid[],
      ${values}::text[]
    ) AS v(id, total)
    WHERE e.id = v.id
  `;
};

const create = async (actorId: string, offeringId: string, input: IExamCreate) => {
  const offering = await requireOfferingForExam(offeringId);
  assertSemesterAllowsExams(offering.semester.status);
  const examDate = new Date(input.examDate);
  if (Number.isNaN(examDate.getTime())) {
    throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'examDate must be a valid date');
  }
  assertExamDateInTerm(examDate, offering.semester.classStartDate, offering.semester.classEndDate);
  const weight = new Prisma.Decimal(input.weight);
  const totalMarks = new Prisma.Decimal(input.totalMarks);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT id FROM course_offerings WHERE id = ${offeringId}::uuid FOR UPDATE
    `;

    if (input.type === ExamType.FINAL) {
      const existingFinal = await tx.exam.findFirst({
        where: { offeringId, type: ExamType.FINAL, deletedAt: null },
        select: { id: true },
      });
      if (existingFinal !== null) {
        throw new ApiError(StatusCodes.CONFLICT, 'A FINAL exam already exists for this offering');
      }
    }

    const aggregate = await tx.exam.aggregate({
      where: { offeringId, deletedAt: null },
      _sum: { weight: true },
    });
    const used = aggregate._sum.weight ?? new Prisma.Decimal(0);
    const remaining = weightRemaining(used);
    if (used.add(weight).gt(WEIGHT_CAP)) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Exam weights cannot exceed ${WEIGHT_CAP}. Current total ${marks(used)}, remaining ${marks(remaining)}`,
      );
    }

    const exam = await tx.exam.create({
      data: {
        offeringId,
        type: input.type,
        title: input.title,
        totalMarks,
        weight,
        examDate,
        isPublished: false,
      },
      select: EXAM_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.CREATE,
      entity: 'Exam',
      entityId: exam.id,
      after: { title: exam.title, type: exam.type, weight: marks(exam.weight) },
    });
    return exam;
  });

  return serializeExam(created);
};

const listByOffering = async (
  offeringId: string,
  query: IExamListQuery,
  viewer: { role: Role; instructorProfileId?: string | undefined },
) => {
  const offering = await requireOfferingForExam(offeringId);
  const pagination = paginate(query, EXAM_SORT_FIELDS);
  const isOwner =
    viewer.role === Role.ADMIN || viewer.instructorProfileId === offering.instructorId;
  const where: Prisma.ExamWhereInput = {
    offeringId,
    deletedAt: null,
    ...(isOwner ? {} : { isPublished: true }),
  };

  const [data, total, aggregate] = await prisma.$transaction([
    prisma.exam.findMany({
      where,
      select: EXAM_SELECT,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.exam.count({ where }),
    prisma.exam.aggregate({
      where: { offeringId, deletedAt: null },
      _sum: { weight: true },
    }),
  ]);

  const used = aggregate._sum.weight ?? new Prisma.Decimal(0);
  return {
    weightRemaining: marks(weightRemaining(used)),
    data: data.map(serializeExam),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const update = async (actorId: string, id: string, input: IExamUpdate) => {
  const exam = await requireLiveExam(id);
  assertSemesterAllowsExams(exam.offering.semester.status);

  const resultCount = await prisma.examResult.count({ where: { examId: id } });
  if (resultCount > 0 && (input.weight !== undefined || input.totalMarks !== undefined)) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot change totalMarks or weight because ${resultCount} result(s) already exist`,
    );
  }

  let examDate = exam.examDate;
  if (input.examDate !== undefined) {
    const parsed = new Date(input.examDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'examDate must be a valid date');
    }
    assertExamDateInTerm(
      parsed,
      exam.offering.semester.classStartDate,
      exam.offering.semester.classEndDate,
    );
    examDate = parsed;
  }

  const nextWeight = input.weight !== undefined ? new Prisma.Decimal(input.weight) : exam.weight;

  const updated = await prisma.$transaction(async (tx) => {
    if (input.weight !== undefined) {
      await tx.$executeRaw`
        SELECT id FROM course_offerings WHERE id = ${exam.offeringId}::uuid FOR UPDATE
      `;
      const aggregate = await tx.exam.aggregate({
        where: { offeringId: exam.offeringId, deletedAt: null, id: { not: id } },
        _sum: { weight: true },
      });
      const used = aggregate._sum.weight ?? new Prisma.Decimal(0);
      if (used.add(nextWeight).gt(WEIGHT_CAP)) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          `Exam weights cannot exceed ${WEIGHT_CAP}. Current total ${marks(used)}, remaining ${marks(weightRemaining(used))}`,
        );
      }
    }

    const row = await tx.exam.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.examDate !== undefined ? { examDate } : {}),
        ...(input.totalMarks !== undefined
          ? { totalMarks: new Prisma.Decimal(input.totalMarks) }
          : {}),
        ...(input.weight !== undefined ? { weight: nextWeight } : {}),
      },
      select: EXAM_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.UPDATE,
      entity: 'Exam',
      entityId: id,
      after: { title: row.title, weight: marks(row.weight) },
    });
    return row;
  });

  return serializeExam(updated);
};

const softDelete = async (actorId: string, id: string) => {
  const exam = await requireLiveExam(id);
  const resultCount = await prisma.examResult.count({ where: { examId: id } });
  if (resultCount > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      `Cannot delete this exam because ${resultCount} result(s) already exist`,
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const row = await tx.exam.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: EXAM_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.DELETE,
      entity: 'Exam',
      entityId: id,
      after: { title: exam.title },
    });
    return row;
  });
  return serializeExam(deleted);
};

const publish = async (actorId: string, id: string, isPublished: boolean) => {
  const exam = await requireLiveExam(id);
  if (!isPublished && exam.offering.semester.status === SemesterStatus.GRADING) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Cannot unpublish an exam once the semester is in GRADING',
    );
  }
  if (!isPublished && exam.offering.semester.status !== SemesterStatus.ONGOING) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Unpublishing is only allowed while the semester is ONGOING',
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.exam.update({
      where: { id },
      data: { isPublished },
      select: EXAM_SELECT,
    });
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.STATUS_CHANGE,
      entity: 'Exam',
      entityId: id,
      before: { isPublished: exam.isPublished },
      after: { isPublished },
    });
    return row;
  });
  return serializeExam(updated);
};

const enterResults = async (actorId: string, examId: string, input: IExamResultsWrite) => {
  const exam = await requireLiveExam(examId);
  assertSemesterAllowsExams(exam.offering.semester.status);

  const roster = await prisma.enrollment.findMany({
    where: { offeringId: exam.offeringId, status: EnrollmentStatus.ENROLLED },
    select: { id: true, examEligible: true },
  });
  const rosterById = new Map(roster.map((row) => [row.id, row]));

  const unknown = input.results
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !rosterById.has(row.enrollmentId));
  if (unknown.length > 0) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'One or more enrollmentIds do not belong to this offering or are not ENROLLED',
      unknown.map(({ row, index }) => ({
        path: `results.${index}.enrollmentId`,
        message: `${row.enrollmentId} is not an ENROLLED student in this offering`,
      })),
    );
  }

  const overMax = input.results
    .map((row, index) => ({ row, index, obtained: new Prisma.Decimal(row.marksObtained) }))
    .filter(({ obtained }) => obtained.lt(0) || obtained.gt(exam.totalMarks));
  if (overMax.length > 0) {
    throw new ApiError(
      StatusCodes.UNPROCESSABLE_ENTITY,
      'One or more marksObtained values are outside 0–totalMarks',
      overMax.map(({ index, obtained }) => ({
        path: `results.${index}.marksObtained`,
        message: `Row ${index}: ${obtained.toFixed(2)} is not between 0 and ${marks(exam.totalMarks)}`,
      })),
    );
  }

  if (exam.type === ExamType.MIDTERM || exam.type === ExamType.FINAL) {
    const ineligible = input.results.filter((row) => {
      const enrollment = rosterById.get(row.enrollmentId);
      return enrollment !== undefined && !enrollment.examEligible;
    });
    if (ineligible.length > 0) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `Cannot enter ${exam.type} marks for exam-ineligible students: ${ineligible.map((row) => row.enrollmentId).join(', ')}`,
      );
    }
  }

  const enrollmentIds = input.results.map((row) => row.enrollmentId);
  const existing = await prisma.examResult.findMany({
    where: { examId, enrollmentId: { in: enrollmentIds } },
    select: { enrollmentId: true },
  });
  const existingSet = new Set(existing.map((row) => row.enrollmentId));

  const stats = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM exams WHERE id = ${examId}::uuid FOR UPDATE`;
    await upsertExamResults(
      tx,
      input.results.map((row) => ({
        id: randomUUID(),
        examId,
        enrollmentId: row.enrollmentId,
        marksObtained: row.marksObtained,
        remarks: row.remarks ?? '',
        evaluatedById: actorId,
      })),
    );
    await recomputeTotalMarks(tx, enrollmentIds);
    await createAuditLog(tx, {
      actorId,
      action: AuditAction.GRADE_SUBMIT,
      entity: 'Exam',
      entityId: examId,
      after: { entered: input.results.length },
    });

    const all = await tx.examResult.findMany({
      where: { examId },
      select: { marksObtained: true },
    });
    const highest = all.reduce(
      (max, row) => (row.marksObtained.gt(max) ? row.marksObtained : max),
      new Prisma.Decimal(0),
    );
    const sum = all.reduce((acc, row) => acc.add(row.marksObtained), new Prisma.Decimal(0));
    const average = all.length === 0 ? new Prisma.Decimal(0) : sum.div(all.length);
    return { highest, average, total: all.length };
  });

  const updated = enrollmentIds.filter((id) => existingSet.has(id)).length;
  return {
    created: enrollmentIds.length - updated,
    updated,
    classAverage: marks(stats.average),
    highestMark: marks(stats.highest),
    resultCount: stats.total,
  };
};

const listResults = async (examId: string, query: IExamListQuery) => {
  await requireLiveExam(examId);
  const pagination = paginate(query, RESULT_SORT_FIELDS);
  const where: Prisma.ExamResultWhereInput = { examId };

  const [data, total] = await prisma.$transaction([
    prisma.examResult.findMany({
      where,
      select: {
        id: true,
        enrollmentId: true,
        marksObtained: true,
        remarks: true,
        enrollment: {
          select: {
            examEligible: true,
            student: {
              select: {
                studentId: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      skip: pagination.skip,
      take: pagination.take,
      orderBy: pagination.orderBy,
    }),
    prisma.examResult.count({ where }),
  ]);

  return {
    data: data.map((row) => ({
      id: row.id,
      enrollmentId: row.enrollmentId,
      marksObtained: marks(row.marksObtained),
      remarks: row.remarks,
      examEligible: row.enrollment.examEligible,
      studentId: row.enrollment.student.studentId,
      firstName: row.enrollment.student.user.firstName,
      lastName: row.enrollment.student.user.lastName,
    })),
    meta: paginationMeta(pagination.page, pagination.limit, total),
  };
};

const listMine = async (studentId: string, query: IMyExamResultsQuery) => {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
      ...(query.offeringId !== undefined ? { offeringId: query.offeringId } : {}),
    },
    select: { id: true, offeringId: true },
  });
  const enrollmentIds = enrollments.map((row) => row.id);
  if (enrollmentIds.length === 0) {
    return { data: [] };
  }

  const results = await prisma.examResult.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      exam: { deletedAt: null, isPublished: true },
    },
    select: {
      id: true,
      marksObtained: true,
      remarks: true,
      enrollmentId: true,
      exam: {
        select: {
          id: true,
          title: true,
          type: true,
          totalMarks: true,
          weight: true,
          examDate: true,
          offering: {
            select: {
              id: true,
              section: true,
              course: { select: { code: true, title: true } },
            },
          },
        },
      },
    },
    orderBy: { exam: { examDate: 'desc' } },
  });

  return {
    data: results.map((row) => ({
      id: row.id,
      marksObtained: marks(row.marksObtained),
      remarks: row.remarks,
      exam: {
        id: row.exam.id,
        title: row.exam.title,
        type: row.exam.type,
        totalMarks: marks(row.exam.totalMarks),
        weight: marks(row.exam.weight),
        examDate: row.exam.examDate.toISOString(),
        offering: row.exam.offering,
      },
    })),
  };
};

export const ExamService = {
  create,
  listByOffering,
  update,
  softDelete,
  publish,
  enterResults,
  listResults,
  listMine,
};
