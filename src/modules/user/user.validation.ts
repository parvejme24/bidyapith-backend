import { Designation, Role, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { PAGINATION } from '../../constants/pagination';

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+8801|01)\d{9}$/,
    'Phone must be a Bangladeshi number (+8801XXXXXXXXX or 01XXXXXXXXX)',
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Invalid email format' }));

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

export const UserValidation = {
  updateMe: z.object({
    body: atLeastOne(
      {
        firstName: z.string().trim().min(1).optional(),
        lastName: z.string().trim().min(1).optional(),
        phone: phoneSchema.optional(),
      },
      'At least one field is required',
    ),
  }),

  createStaff: z.object({
    body: z
      .object({
        firstName: z.string().trim().min(1, 'First name is required'),
        lastName: z.string().trim().min(1, 'Last name is required'),
        email: emailSchema,
        phone: phoneSchema.optional(),
        role: z.enum([Role.INSTRUCTOR, Role.ADMIN]),
        departmentId: z.uuid().optional(),
        designation: z.enum(Designation).optional(),
        joiningDate: z.iso.datetime().or(z.string().date()).optional(),
        specialization: z.string().trim().min(1).optional(),
      })
      .superRefine((value, ctx) => {
        if (value.role === Role.INSTRUCTOR) {
          if (value.departmentId === undefined) {
            ctx.addIssue({
              code: 'custom',
              message: 'departmentId is required for instructors',
              path: ['departmentId'],
            });
          }
          if (value.designation === undefined) {
            ctx.addIssue({
              code: 'custom',
              message: 'designation is required for instructors',
              path: ['designation'],
            });
          }
          if (value.joiningDate === undefined) {
            ctx.addIssue({
              code: 'custom',
              message: 'joiningDate is required for instructors',
              path: ['joiningDate'],
            });
          }
        }
      }),
  }),

  list: z.object({
    query: paginationQuery.extend({
      role: z.enum(Role).optional(),
      status: z.enum(UserStatus).optional(),
      search: z.string().optional(),
    }),
  }),

  idParam: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
  }),

  changeRole: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z.object({
      role: z.enum(Role),
    }),
  }),

  changeStatus: z.object({
    params: z.object({
      id: z.uuid({ error: 'id must be a valid UUID' }),
    }),
    body: z.object({
      status: z.enum([UserStatus.ACTIVE, UserStatus.BLOCKED]),
    }),
  }),
};
