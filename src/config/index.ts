import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

const SECRET_DIR = '/etc/secrets';

const tryLoadDotenv = (filePath: string): boolean => {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  const result = dotenv.config({ path: filePath, quiet: true });
  if (result.error !== undefined) {
    console.error(`> dotenv failed to parse ${filePath}: ${result.error.message}`);
    return false;
  }
  console.log(`> loaded env file ${filePath}`);
  return true;
};

const loadEnvFiles = (): string[] => {
  const loaded: string[] = [];
  if (fs.existsSync(SECRET_DIR) && fs.statSync(SECRET_DIR).isDirectory()) {
    for (const name of fs.readdirSync(SECRET_DIR)) {
      const filePath = path.join(SECRET_DIR, name);
      if (tryLoadDotenv(filePath)) {
        loaded.push(filePath);
      }
    }
  }
  const localCandidates = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'env'),
  ];
  for (const filePath of localCandidates) {
    if (tryLoadDotenv(filePath) && !loaded.includes(filePath)) {
      loaded.push(filePath);
    }
  }
  dotenv.config({ quiet: true });
  return loaded;
};

const loadedEnvFiles = loadEnvFiles();

const optionalString = z.preprocess(
  (value) => (value === undefined || value === null ? '' : value),
  z.string(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5001),
  DATABASE_URL: z.string().min(1, 'Set DATABASE_URL in Render → Environment'),
  DIRECT_URL: optionalString,
  REDIS_URL: optionalString,
  PG_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),
  PG_POOL_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

  JWT_ACCESS_SECRET: z.string().min(32, 'Set JWT_ACCESS_SECRET (≥32 chars) in Render → Environment'),
  JWT_REFRESH_SECRET: z.string().min(32, 'Set JWT_REFRESH_SECRET (≥32 chars) in Render → Environment'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  GOOGLE_CLIENT_ID: optionalString,
  CLIENT_URL: z.string().url().default('http://localhost:3000'),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.preprocess(
    (value) => (value === '' || value === undefined ? 587 : value),
    z.coerce.number().int().positive(),
  ),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: z.string().optional().default('Bidyapith <noreply@bidyapith.edu>'),

  CRON_SECRET: optionalString,

  PAYMENT_GATEWAY: z.enum(['STRIPE', 'SSLCOMMERZ']).default('STRIPE'),
  STRIPE_SECRET_KEY: z.string().min(1, 'Set STRIPE_SECRET_KEY in Render → Environment'),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    (value) => (value === '' || value === undefined ? 'whsec_dev_placeholder' : value),
    z.string().min(1),
  ),
  PAYMENT_SUCCESS_URL: z.string().url().default('http://localhost:3000/payment/success'),
  PAYMENT_CANCEL_URL: z.string().url().default('http://localhost:3000/payment/cancel'),
  DEFAULT_CURRENCY: z.string().length(3).default('BDT'),
});

export type Config = z.infer<typeof envSchema>;

/** Vercel sets CI during `vercel build` while it introspects the Express app. Runtime does not. */
const isVercelBuild = process.env['VERCEL'] === '1' && process.env['CI'] === '1';

const BUILD_PLACEHOLDERS: Config = {
  NODE_ENV: 'production',
  PORT: 5001,
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/bidyapith',
  DIRECT_URL: '',
  REDIS_URL: '',
  PG_POOL_MAX: 1,
  PG_POOL_TIMEOUT_MS: 20_000,
  JWT_ACCESS_SECRET: '0'.repeat(32),
  JWT_REFRESH_SECRET: '1'.repeat(32),
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '30d',
  BCRYPT_SALT_ROUNDS: 12,
  GOOGLE_CLIENT_ID: '',
  CLIENT_URL: 'http://localhost:3000',
  CLOUDINARY_CLOUD_NAME: 'build',
  CLOUDINARY_API_KEY: 'build',
  CLOUDINARY_API_SECRET: 'build',
  SMTP_HOST: '',
  SMTP_PORT: 587,
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'Bidyapith <noreply@bidyapith.edu>',
  CRON_SECRET: '',
  PAYMENT_GATEWAY: 'STRIPE',
  STRIPE_SECRET_KEY: 'sk_test_build_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_build_placeholder',
  PAYMENT_SUCCESS_URL: 'http://localhost:3000/payment/success',
  PAYMENT_CANCEL_URL: 'http://localhost:3000/payment/cancel',
  DEFAULT_CURRENCY: 'BDT',
};

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  if (!isVercelBuild) {
    const secretNames = fs.existsSync(SECRET_DIR)
      ? fs.readdirSync(SECRET_DIR).join(', ') || '(empty directory)'
      : '(no /etc/secrets directory)';
    throw new Error(
      [
        'Invalid environment variables:',
        details,
        '',
        `Loaded env files: ${loadedEnvFiles.length > 0 ? loadedEnvFiles.join(', ') : 'none'}`,
        `/etc/secrets files: ${secretNames}`,
        `DATABASE_URL in process.env: ${process.env['DATABASE_URL'] === undefined ? 'no' : 'yes'}`,
        '',
        'Render does not use your laptop .env. In the service → Environment, click "Add from .env", paste your local .env, then Save, rebuild, and deploy.',
      ].join('\n'),
    );
  }
  console.warn(`> Env incomplete during Vercel build; using placeholders.\n${details}`);
}

export const config: Config = parsed.success ? parsed.data : BUILD_PLACEHOLDERS;
