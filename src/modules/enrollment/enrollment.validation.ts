import { EnrollmentStatus } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const EnrollmentValidation = {
  create: z.object({
    body: z
      .object({
        offeringId: z.uuid({ error: 'offeringId must be a valid UUID' }),
      })
      .strict(),
  }),

  adminCreate: z.object({
    body: z
      .object({
        studentId: z.uuid({ error: 'studentId must be a valid UUID' }),
        offeringId: z.uuid({ error: 'offeringId must be a valid UUID' }),
        skipChecks: z.array(z.string()).optional(),
      })
      .strict(),
  }),

  myCourses: z.object({
    query: paginationQuery.extend({
      semesterId: z.uuid().optional(),
      status: z.enum(EnrollmentStatus).optional(),
    }),
  }),

  availableCourses: z.object({
    query: z.object({
      eligibleOnly: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => (value === 'true' ? true : undefined)),
    }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      studentId: z.uuid().optional(),
      offeringId: z.uuid().optional(),
      semesterId: z.uuid().optional(),
      status: z.enum(EnrollmentStatus).optional(),
    }),
  }),

  roster: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    query: paginationQuery.extend({
      includeDropped: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => (value === 'true' ? true : undefined)),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),
};
