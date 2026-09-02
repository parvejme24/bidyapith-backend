import { SemesterStatus, SemesterTerm } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';
import { SEMESTER_DATE_ORDER_MESSAGE, semesterDatesInOrder } from './semester.constant';

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.MAX_LIMIT).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const dateInput = z.coerce.date({ error: 'Must be a valid ISO date-time' });

const semesterDateShape = {
  registrationStart: dateInput,
  registrationEnd: dateInput,
  dropDeadline: dateInput,
  classStartDate: dateInput,
  classEndDate: dateInput,
};

const withDateOrder = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).superRefine((value, ctx) => {
    if (!semesterDatesInOrder(value as z.infer<z.ZodObject<typeof semesterDateShape>>)) {
      ctx.addIssue({
        code: 'custom',
        message: SEMESTER_DATE_ORDER_MESSAGE,
      });
    }
  });

const atLeastOne = <T extends z.ZodRawShape>(shape: T, message: string) =>
  z.object(shape).refine((value) => Object.values(value).some((field) => field !== undefined), {
    message,
  });

export const SemesterValidation = {
  create: z.object({
    body: withDateOrder({
      term: z.enum(SemesterTerm),
      year: z.number().int().min(2000).max(2100),
      ...semesterDateShape,
    }).strict(),
  }),

  update: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        registrationStart: dateInput.optional(),
        registrationEnd: dateInput.optional(),
        dropDeadline: dateInput.optional(),
        classStartDate: dateInput.optional(),
        classEndDate: dateInput.optional(),
      },
      'At least one date field is required',
    ).strict(),
  }),

  changeStatus: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        status: z.enum(SemesterStatus),
      })
      .strict(),
  }),

  list: z.object({
    query: paginationQuery.extend({
      status: z.enum(SemesterStatus).optional(),
      year: z.coerce.number().int().min(2000).max(2100).optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),
};
