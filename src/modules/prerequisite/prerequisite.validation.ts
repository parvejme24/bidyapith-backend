import { Prisma } from '@prisma/client';
import { z } from 'zod';

const gradePoint = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^(?:\d+|\d+\.\d{1,2})$/.test(value), {
    message: 'minGradePoint must be a decimal with up to 2 places',
  })
  .refine((value) => {
    const amount = new Prisma.Decimal(value);
    return amount.gte(0) && amount.lte(4);
  }, 'minGradePoint must be between 0.00 and 4.00');

export const PrerequisiteValidation = {
  create: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z.object({
      prerequisiteId: z.uuid({ error: 'prerequisiteId must be a valid UUID' }),
      minGradePoint: gradePoint.optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  deleteParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
      prerequisiteId: z.uuid({ error: 'prerequisiteId must be a valid UUID' }),
    }),
  }),
};
