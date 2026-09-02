import { ExamType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const atLeastOne = <T extends z.ZodRawShape>(shape: T, message: string) =>
  z.object(shape).refine((value) => Object.values(value).some((field) => field !== undefined), {
    message,
  });

const decimalField = (min: string, max: string, message: string) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^(?:\d+|\d+\.\d{1,2})$/.test(value), {
      message: 'Must be a decimal number with up to 2 decimal places',
    })
    .refine((value) => {
      const amount = new Prisma.Decimal(value);
      return amount.gte(min) && amount.lte(max);
    }, message);

export const ExamValidation = {
  offeringId: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  offeringList: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    query: paginationQuery,
  }),

  create: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        type: z.enum(ExamType),
        title: z.string().trim().min(1).max(120),
        totalMarks: decimalField('1', '1000', 'totalMarks must be between 1 and 1000'),
        weight: decimalField('0.01', '100', 'weight must be between 0.01 and 100'),
        examDate: z.string().min(1),
      })
      .strict(),
  }),

  update: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        title: z.string().trim().min(1).max(120).optional(),
        examDate: z.string().min(1).optional(),
        totalMarks: decimalField('1', '1000', 'totalMarks must be between 1 and 1000').optional(),
        weight: decimalField('0.01', '100', 'weight must be between 0.01 and 100').optional(),
      },
      'At least one field is required',
    ).strict(),
  }),

  publish: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        isPublished: z.boolean(),
      })
      .strict(),
  }),

  results: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        results: z
          .array(
            z.object({
              enrollmentId: z.uuid({ error: 'enrollmentId must be a valid UUID' }),
              marksObtained: decimalField('0', '1000', 'marksObtained must be a decimal number'),
              remarks: z.string().trim().max(255).optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .strict()
      .superRefine((value, ctx) => {
        const seen = new Set<string>();
        for (const [index, item] of value.results.entries()) {
          if (seen.has(item.enrollmentId)) {
            ctx.addIssue({
              code: 'custom',
              path: ['results', index, 'enrollmentId'],
              message: 'Duplicate enrollmentId in payload',
            });
          }
          seen.add(item.enrollmentId);
        }
      }),
  }),

  resultsList: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    query: paginationQuery,
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  myResults: z.object({
    query: z.object({
      offeringId: z.uuid().optional(),
    }),
  }),
};
