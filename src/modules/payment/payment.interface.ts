import type { PaymentGateway, PaymentStatus } from '@prisma/client';
import type { PaginationQuery } from '../../shared/paginate';

export type IPaymentInitiate = {
  invoiceId: string;
};

export type IPaymentRefund = {
  reason: string;
};

export type IPaymentListQuery = PaginationQuery & {
  status?: PaymentStatus | undefined;
  gateway?: PaymentGateway | undefined;
  invoiceId?: string | undefined;
};

export type IMyPaymentQuery = PaginationQuery;
