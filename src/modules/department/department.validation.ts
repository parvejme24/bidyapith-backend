import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const departmentCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2,6}$/, 'Department code must be 2–6 uppercase letters');

const atLeastOne = <T extends z.ZodRawShape>(shape: T, message: string) =>
  z.object(shape).refine((value) => Object.values(value).some((field) => field !== undefined), {
    message,
  });

export const DepartmentValidation = {
  create: z.object({
    body: z.object({
      code: departmentCode,
      name: z.string().trim().min(1).max(120),
      contactEmail: z.email({ error: 'Invalid email format' }).optional(),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        code: departmentCode.optional(),
        name: z.string().trim().min(1).max(120).optional(),
        contactEmail: z.email({ error: 'Invalid email format' }).nullable().optional(),
      },
      'At least one field is required',
    ),
  }),

  list: z.object({
    query: paginationQuery.extend({
      search: z.string().optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),
};
