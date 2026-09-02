import { StudentStatus } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+8801|01)\d{9}$/,
    'Phone must be a Bangladeshi number (+8801XXXXXXXXX or 01XXXXXXXXX)',
  );

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const StudentValidation = {
  updateMe: z.object({
    body: z
      .object({
        guardianName: z.string().trim().min(1).optional(),
        guardianPhone: phoneSchema.optional(),
        address: z.string().trim().min(1).optional(),
      })
      .refine((value) => Object.values(value).some((field) => field !== undefined), {
        message: 'At least one field is required',
      }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      programId: z.uuid().optional(),
      batch: z.string().optional(),
      status: z.enum(StudentStatus).optional(),
      search: z.string().optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  adminUpdate: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        programId: z.uuid().optional(),
        batch: z.string().trim().min(1).optional(),
        status: z.enum(StudentStatus).optional(),
      })
      .refine((value) => Object.values(value).some((field) => field !== undefined), {
        message: 'At least one field is required',
      }),
  }),
};
