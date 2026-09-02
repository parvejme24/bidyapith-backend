export const PAYMENT_SORT_FIELDS = [
  'createdAt',
  'initiatedAt',
  'paidAt',
  'amount',
  'status',
] as const;

export const INITIATE_LOCK_MS = 5 * 60 * 1000;
export const STALE_PAYMENT_MS = 2 * 60 * 60 * 1000;
export const STALE_JOB_INTERVAL_MS = 60 * 60 * 1000;

export const PAYMENT_SELECT = {
  id: true,
  invoiceId: true,
  transactionRef: true,
  gateway: true,
  status: true,
  amount: true,
  currency: true,
  gatewayTransactionId: true,
  gatewaySessionId: true,
  failureReason: true,
  initiatedAt: true,
  paidAt: true,
  refundedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
