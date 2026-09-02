import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ quiet: true });

/** Generate does not connect; a placeholder keeps `prisma generate` working when env is unset (CI/Vercel). */
const PLACEHOLDER_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/bidyapith';

const directUrl = process.env['DIRECT_URL'];
const databaseUrl = process.env['DATABASE_URL'];
const migrationUrl =
  directUrl !== undefined && directUrl.length > 0
    ? directUrl
    : databaseUrl !== undefined && databaseUrl.length > 0
      ? databaseUrl
      : PLACEHOLDER_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --transpile-only prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
});
