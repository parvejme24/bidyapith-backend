import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

dotenv.config({ quiet: true });

const directUrl = process.env['DIRECT_URL'];
const migrationUrl =
  directUrl !== undefined && directUrl.length > 0 ? directUrl : env('DATABASE_URL');

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
