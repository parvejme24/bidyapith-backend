import { AttendanceStatus } from '@prisma/client';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const record = z.object({
  enrollmentId: z.uuid({ error: 'enrollmentId must be a valid UUID' }),
  status: z.enum(AttendanceStatus),
  remarks: z.string().trim().max(255).optional(),
});

export const AttendanceValidation = {
  offeringId: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  mark: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        date: isoDate,
        records: z.array(record).min(1).max(200),
      })
      .strict()
      .superRefine((value, ctx) => {
        const seen = new Set<string>();
        for (const [index, item] of value.records.entries()) {
          if (seen.has(item.enrollmentId)) {
            ctx.addIssue({
              code: 'custom',
              path: ['records', index, 'enrollmentId'],
              message: 'Duplicate enrollmentId in payload',
            });
          }
          seen.add(item.enrollmentId);
        }
      }),
  }),

  byDate: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    query: z.object({
      date: isoDate,
    }),
  }),
};
