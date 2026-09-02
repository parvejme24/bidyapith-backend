import type { AuditAction, Prisma } from '@prisma/client';

export type AuditLogInput = {
  action: AuditAction;
  entity: string;
  userId?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
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
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
    },
  });
};
