import { DayOfWeek, OfferingStatus } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';
import { isValidTimeRange } from '../../utils/scheduleConflict';

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

const sectionSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]$/, 'section must be a single letter A–Z');

const roomSchema = z.string().trim().min(1).max(30);

const scheduleSlot = z
  .object({
    dayOfWeek: z.enum(DayOfWeek),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:MM'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:MM'),
    room: roomSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!isValidTimeRange(value.startTime, value.endTime)) {
      ctx.addIssue({
        code: 'custom',
        message: 'endTime must be after startTime',
        path: ['endTime'],
      });
    }
  });

const uniqueScheduleKeys = (slots: { dayOfWeek: DayOfWeek; startTime: string }[]): boolean => {
  const seen = new Set<string>();
  for (const slot of slots) {
    const key = `${slot.dayOfWeek}:${slot.startTime}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
  }
  return true;
};

export const OfferingValidation = {
  create: z.object({
    body: z
      .object({
        courseId: z.uuid({ error: 'courseId must be a valid UUID' }),
        semesterId: z.uuid({ error: 'semesterId must be a valid UUID' }),
        section: sectionSchema,
        capacity: z.number().int().min(1).max(300).optional(),
        room: roomSchema.optional(),
        instructorId: z.uuid({ error: 'instructorId must be a valid UUID' }).optional(),
        schedules: z
          .array(scheduleSlot)
          .max(14)
          .refine(uniqueScheduleKeys, 'Duplicate schedule slots are not allowed')
          .optional(),
      })
      .strict(),
  }),

  update: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: atLeastOne(
      {
        capacity: z.number().int().min(1).max(300).optional(),
        room: roomSchema.nullable().optional(),
        section: sectionSchema.optional(),
      },
      'At least one field is required',
    ).strict(),
  }),

  assignInstructor: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        instructorId: z.uuid({ error: 'instructorId must be a valid UUID' }).nullable(),
      })
      .strict(),
  }),

  changeStatus: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z
      .object({
        status: z.enum(OfferingStatus),
      })
      .strict(),
  }),

  addSchedule: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: scheduleSlot.strict(),
  }),

  scheduleParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
      scheduleId: z.uuid({ error: 'scheduleId must be a valid UUID' }),
    }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      semesterId: z.uuid().optional(),
      courseId: z.uuid().optional(),
      instructorId: z.uuid().optional(),
      departmentId: z.uuid().optional(),
      status: z.enum(OfferingStatus).optional(),
      hasSeats: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => (value === 'true' ? true : undefined)),
      search: z.string().optional(),
    }),
  }),

  myTeaching: z.object({
    query: paginationQuery.extend({
      semesterId: z.uuid().optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),
};
