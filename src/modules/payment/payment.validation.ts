import { PaymentGateway, PaymentStatus } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const PaymentValidation = {
  initiate: z.object({
    body: z.object({
      invoiceId: z.uuid({ error: 'invoiceId must be a valid UUID' }),
    }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      status: z.enum(PaymentStatus).optional(),
      gateway: z.enum(PaymentGateway).optional(),
      invoiceId: z.uuid().optional(),
    }),
  }),

  myHistory: z.object({
    query: paginationQuery,
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  verify: z.object({
    params: z.object({
      transactionRef: z.string().trim().min(1).max(60),
    }),
  }),

  refund: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        reason: z.string().trim().min(10).max(2000),
      })
      .strict(),
  }),
};
