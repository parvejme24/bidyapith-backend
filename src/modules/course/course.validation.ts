import { CourseType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const courseCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3,4}-\d{4}$/, 'Course code must match XXX-0000 (3–4 letters, hyphen, 4 digits)');

const creditsInput = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^(?:\d+|\d+\.\d{1,2})$/.test(value), {
    message: 'Credits must be a decimal number',
  })
  .refine((value) => {
    const amount = new Prisma.Decimal(value);
    return amount.gte('0.5') && amount.lte('6') && amount.mod('0.5').isZero();
  }, 'Credits must be between 0.5 and 6.0 in 0.5 increments (for example 1.0 or 1.5, not 2.3)');

const atLeastOne = <T extends z.ZodRawShape>(shape: T, message: string) =>
  z.object(shape).refine((value) => Object.values(value).some((field) => field !== undefined), {
    message,
  });

export const CourseValidation = {
  create: z.object({
    body: z.object({
      code: courseCode,
      title: z.string().trim().min(1).max(180),
      description: z.string().trim().min(1).optional(),
      credits: creditsInput,
      type: z.enum(CourseType).optional(),
      level: z.number().int().min(1).max(4).optional(),
      departmentId: z.uuid({ error: 'departmentId must be a valid UUID' }),
    }),
  }),

  update: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        code: courseCode.optional(),
        title: z.string().trim().min(1).max(180).optional(),
        description: z.string().trim().min(1).nullable().optional(),
        credits: creditsInput.optional(),
        type: z.enum(CourseType).optional(),
        level: z.number().int().min(1).max(4).optional(),
        departmentId: z.uuid({ error: 'departmentId must be a valid UUID' }).optional(),
      },
      'At least one field is required',
    ),
  }),

  list: z.object({
    query: paginationQuery.extend({
      search: z.string().optional(),
      departmentId: z.uuid().optional(),
      type: z.enum(CourseType).optional(),
      level: z.coerce.number().int().min(1).max(4).optional(),
      minCredits: z.coerce.number().positive().optional(),
      maxCredits: z.coerce.number().positive().optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),
};
