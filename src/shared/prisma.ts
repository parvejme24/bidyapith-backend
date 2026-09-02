import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const pgConnectionString = config.DATABASE_URL.replace(
  /([?&])sslmode=require\b/,
  '$1sslmode=verify-full',
);

const adapter = new PrismaPg({ connectionString: pgConnectionString });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
