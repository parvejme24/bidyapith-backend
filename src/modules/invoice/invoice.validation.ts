import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';
import { MANUAL_INVOICE_TYPES } from './invoice.constant';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const moneyInput = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^(?:\d+|\d+\.\d{1,2})$/.test(value), {
    message: 'Amount must be a decimal with up to 2 places',
  })
  .refine((value) => {
    const amount = Number(value);
    return amount >= 1 && amount <= 1_000_000;
  }, 'totalAmount must be between 1 and 1000000');

export const InvoiceValidation = {
  myList: z.object({
    query: paginationQuery.extend({
      status: z.enum(InvoiceStatus).optional(),
      semesterId: z.uuid().optional(),
    }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      status: z.enum(InvoiceStatus).optional(),
      semesterId: z.uuid().optional(),
      studentId: z.uuid().optional(),
      type: z.enum(InvoiceType).optional(),
      search: z.string().trim().max(60).optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  create: z.object({
    body: z
      .object({
        studentId: z.uuid({ error: 'studentId must be a valid UUID' }),
        semesterId: z.uuid({ error: 'semesterId must be a valid UUID' }),
        type: z.enum(MANUAL_INVOICE_TYPES),
        totalAmount: moneyInput,
        dueDate: z.string().min(1),
        notes: z.string().trim().max(2000).optional(),
      })
      .strict(),
  }),

  generate: z.object({
    body: z
      .object({
        semesterId: z.uuid({ error: 'semesterId must be a valid UUID' }),
      })
      .strict(),
  }),

  waive: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        reason: z.string().trim().min(10).max(2000),
      })
      .strict(),
  }),

  cancel: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),
};
