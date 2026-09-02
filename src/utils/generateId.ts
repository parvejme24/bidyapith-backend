import type { Prisma } from '@prisma/client';

const SEQUENCE_PAD = 4;

const nextSequence = (latest: string | null, prefix: string): number => {
  if (latest === null || !latest.startsWith(prefix)) {
    return 1;
  }
  const raw = latest.slice(prefix.length);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed + 1 : 1;
};

export const generateStudentId = async (
  tx: Prisma.TransactionClient,
  programId: string,
  programCode: string,
  year: number,
): Promise<string> => {
  const lockKey = `student-id:${programId}:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const prefix = `${year}-${programCode.toUpperCase()}-`;
  const latest = await tx.studentProfile.findFirst({
    where: {
      programId,
      studentId: { startsWith: prefix },
    },
    orderBy: { studentId: 'desc' },
    select: { studentId: true },
  });

  const sequence = nextSequence(latest?.studentId ?? null, prefix);
  return `${prefix}${String(sequence).padStart(SEQUENCE_PAD, '0')}`;
};

export const generateEmployeeId = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> => {
  const lockKey = `employee-id:${year}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const prefix = `EMP-${year}`;
  const latest = await tx.instructorProfile.findFirst({
    where: { employeeId: { startsWith: prefix } },
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  });

  const sequence = nextSequence(latest?.employeeId ?? null, prefix);
  return `${prefix}${String(sequence).padStart(SEQUENCE_PAD, '0')}`;
};
