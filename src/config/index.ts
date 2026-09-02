import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  PG_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  PG_POOL_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),

  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.preprocess(
    (value) => (value === '' || value === undefined ? 587 : value),
    z.coerce.number().int().positive(),
  ),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('Bidyapith <noreply@bidyapith.edu>'),

  CRON_SECRET: z.string().optional().default(''),

  PAYMENT_GATEWAY: z.enum(['STRIPE', 'SSLCOMMERZ']).default('STRIPE'),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  PAYMENT_SUCCESS_URL: z.string().url().default('http://localhost:3000/payment/success'),
  PAYMENT_CANCEL_URL: z.string().url().default('http://localhost:3000/payment/cancel'),
  DEFAULT_CURRENCY: z.string().length(3).default('BDT'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment variables:\n${details}`);
}

export const config = parsed.data;
export type Config = typeof config;
