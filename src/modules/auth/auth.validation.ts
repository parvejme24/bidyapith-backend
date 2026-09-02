import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Invalid email format' }));

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .superRefine((value, ctx) => {
    if (!/[A-Za-z]/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password must contain at least one letter',
      });
    }
    if (!/[0-9]/.test(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password must contain at least one number',
      });
    }
  });

const phoneSchema = z
  .string()
  .trim()
  .regex(
    /^(\+8801|01)\d{9}$/,
    'Phone must be a Bangladeshi number (+8801XXXXXXXXX or 01XXXXXXXXX)',
  )
  .optional();

export const AuthValidation = {
  register: z.object({
    body: z.object({
      firstName: z.string().trim().min(1, 'First name is required'),
      lastName: z.string().trim().min(1, 'Last name is required'),
      email: emailSchema,
      password: passwordSchema,
      phone: phoneSchema,
      programId: z.uuid({ error: 'programId must be a valid UUID' }),
    }),
  }),

  login: z.object({
    body: z.object({
      email: emailSchema,
      password: z.string().min(1, 'Password is required'),
    }),
  }),

  google: z.object({
    body: z.object({
      idToken: z.string().min(1, 'idToken is required'),
    }),
  }),

  refreshToken: z.object({
    cookies: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required'),
    }),
  }),

  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: passwordSchema,
    }),
  }),

  forgotPassword: z.object({
    body: z.object({
      email: emailSchema,
    }),
  }),

  resetPassword: z.object({
    body: z.object({
      token: z.string().min(1, 'Reset token is required'),
      newPassword: passwordSchema,
    }),
  }),

  verifyEmail: z.object({
    body: z.object({
      token: z.string().min(1, 'Verification token is required'),
    }),
  }),
};
