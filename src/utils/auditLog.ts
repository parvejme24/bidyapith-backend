import type { AuditAction, Prisma } from '@prisma/client';

export type AuditLogInput = {
  action: AuditAction;
  entity: string;
  actorId?: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

export const createAuditLog = async (
  tx: Prisma.TransactionClient,
  input: AuditLogInput,
): Promise<void> => {
  await tx.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      ...(input.actorId !== undefined ? { actorId: input.actorId } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.before !== undefined ? { before: input.before } : {}),
      ...(input.after !== undefined ? { after: input.after } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    },
  });
};
