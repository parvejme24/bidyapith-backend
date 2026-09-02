import { LetterGrade } from '@prisma/client';
import { z } from 'zod';

const uuidParam = z.object({
  id: z.uuid({ error: 'id must be a valid UUID' }),
});

const gradeEntry = z
  .object({
    enrollmentId: z.uuid({ error: 'enrollmentId must be a valid UUID' }),
    letterGrade: z.enum(LetterGrade).optional(),
    remarks: z.string().trim().max(255).optional(),
  })
  .strict();

export const ResultValidation = {
  offeringId: z.object({
    params: uuidParam,
  }),

  submit: z.object({
    params: uuidParam,
    body: z
      .object({
        grades: z.array(gradeEntry).min(1).max(500),
      })
      .strict()
      .superRefine((value, ctx) => {
        const seen = new Set<string>();
        for (const [index, item] of value.grades.entries()) {
          if (seen.has(item.enrollmentId)) {
            ctx.addIssue({
              code: 'custom',
              path: ['grades', index, 'enrollmentId'],
              message: 'Duplicate enrollmentId in payload',
            });
          }
          seen.add(item.enrollmentId);
        }
      }),
  }),

  patch: z.object({
    params: uuidParam,
    body: z
      .object({
        letterGrade: z.enum(LetterGrade),
      })
      .strict(),
  }),

  semesterId: z.object({
    params: uuidParam,
  }),

  myResults: z.object({
    query: z.object({
      semesterId: z.uuid().optional(),
    }),
  }),

  studentId: z.object({
    params: uuidParam,
  }),
};
