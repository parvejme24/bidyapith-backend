import { PaymentStatus } from '@prisma/client';
import { STALE_JOB_INTERVAL_MS, STALE_PAYMENT_MS } from '../modules/payment/payment.constant';
import { prisma } from '../shared/prisma';

export const expireStalePayments = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - STALE_PAYMENT_MS);
  const result = await prisma.payment.updateMany({
    where: {
      status: PaymentStatus.INITIATED,
      initiatedAt: { lt: cutoff },
    },
    data: {
      status: PaymentStatus.CANCELLED,
      failureReason: 'EXPIRED',
    },
  });
  if (result.count > 0) {
    console.log(`> expireStalePayments: cancelled ${result.count} stale INITIATED payment(s)`);
  }
  return result.count;
};

export const startExpireStalePaymentsJob = (): void => {
  const tick = (): void => {
    void expireStalePayments().catch((error: unknown) => {
      console.error('[jobs] expireStalePayments failed', error);
    });
  };
  tick();
  setInterval(tick, STALE_JOB_INTERVAL_MS);
};
