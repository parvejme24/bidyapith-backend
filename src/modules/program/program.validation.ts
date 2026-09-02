import { CourseType, DegreeType } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const programCode = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(15)
  .regex(/^[A-Z0-9-]+$/, 'Program code may only contain letters, digits, and hyphens');

const moneyInput = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => /^(?:\d+|\d+\.\d{1,2})$/.test(value), {
    message: 'Amount must be a decimal with up to 2 places',
  });

const creditBounds = {
  minCreditsPerSemester: z.number().int().min(0).max(30).optional(),
  maxCreditsPerSemester: z.number().int().min(0).max(30).optional(),
};

const atLeastOne = <T extends z.ZodRawShape>(shape: T, message: string) =>
  z.object(shape).refine((value) => Object.values(value).some((field) => field !== undefined), {
    message,
  });

const refineCreditRange = (
  value: { minCreditsPerSemester?: number | undefined; maxCreditsPerSemester?: number | undefined },
  ctx: z.RefinementCtx,
) => {
  if (
    value.minCreditsPerSemester !== undefined &&
    value.maxCreditsPerSemester !== undefined &&
    value.maxCreditsPerSemester < value.minCreditsPerSemester
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['maxCreditsPerSemester'],
      message: 'maxCreditsPerSemester must be greater than or equal to minCreditsPerSemester',
    });
  }
};

export const ProgramValidation = {
  create: z.object({
    body: z
      .object({
        code: programCode,
        name: z.string().trim().min(1).max(150),
        departmentId: z.uuid({ error: 'departmentId must be a valid UUID' }),
        degreeType: z.enum(DegreeType),
        totalCredits: z.number().int().min(30).max(200),
        durationYears: z.number().int().min(1).max(6).optional(),
        ...creditBounds,
        feePerCredit: moneyInput,
        registrationFee: moneyInput.optional(),
      })
      .superRefine(refineCreditRange),
  }),

  update: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        code: programCode.optional(),
        name: z.string().trim().min(1).max(150).optional(),
        departmentId: z.uuid({ error: 'departmentId must be a valid UUID' }).optional(),
        degreeType: z.enum(DegreeType).optional(),
        totalCredits: z.number().int().min(30).max(200).optional(),
        durationYears: z.number().int().min(1).max(6).optional(),
        minCreditsPerSemester: z.number().int().min(0).max(30).optional(),
        maxCreditsPerSemester: z.number().int().min(0).max(30).optional(),
        feePerCredit: moneyInput.optional(),
        registrationFee: moneyInput.optional(),
      },
      'At least one field is required',
    ).superRefine(refineCreditRange),
  }),

  list: z.object({
    query: paginationQuery.extend({
      departmentId: z.uuid().optional(),
      degreeType: z.enum(DegreeType).optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  addCourse: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z.object({
      courseId: z.uuid({ error: 'courseId must be a valid UUID' }),
      type: z.enum(CourseType).optional(),
      recommendedSemester: z.number().int().min(1).optional(),
    }),
  }),

  patchCourse: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
      courseId: z.uuid({ error: 'courseId must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        type: z.enum(CourseType).optional(),
        recommendedSemester: z.number().int().min(1).optional(),
      },
      'At least one field is required',
    ),
  }),

  courseParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
      courseId: z.uuid({ error: 'courseId must be a valid UUID' }),
    }),
  }),
};
