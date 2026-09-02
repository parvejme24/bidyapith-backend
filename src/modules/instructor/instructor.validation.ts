import { Designation } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const InstructorValidation = {
  updateMe: z.object({
    body: z.object({
      specialization: z
        .string()
        .trim()
        .transform((value) => (value.length === 0 ? null : value))
        .nullable(),
    }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      departmentId: z.uuid().optional(),
      designation: z.enum(Designation).optional(),
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
        departmentId: z.uuid().optional(),
        designation: z.enum(Designation).optional(),
        specialization: z.string().trim().min(1).optional(),
      })
      .refine((value) => Object.values(value).some((field) => field !== undefined), {
        message: 'At least one field is required',
      }),
  }),
};
