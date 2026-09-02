import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const poolSettings = (() => {
  const url = new URL(config.DATABASE_URL);
  const maxFromUrl = url.searchParams.get('connection_limit');
  const timeoutFromUrl = url.searchParams.get('pool_timeout');
  url.searchParams.delete('connection_limit');
  url.searchParams.delete('pool_timeout');

  const parsedMax = maxFromUrl === null ? Number.NaN : Number.parseInt(maxFromUrl, 10);
  const parsedTimeoutSec = timeoutFromUrl === null ? Number.NaN : Number.parseInt(timeoutFromUrl, 10);

  const resolvedMax =
    Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : config.PG_POOL_MAX;
  const max = process.env['VERCEL'] === '1' ? Math.min(resolvedMax, 1) : resolvedMax;
  const connectionString = url.toString();
  const needsSsl =
    process.env['VERCEL'] === '1' ||
    connectionString.includes('sslmode=require') ||
    connectionString.includes('neon.tech');

  return {
    connectionString,
    max,
    connectionTimeoutMillis:
      Number.isFinite(parsedTimeoutSec) && parsedTimeoutSec > 0
        ? parsedTimeoutSec * 1000
        : config.PG_POOL_TIMEOUT_MS,
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  };
})();

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: poolSettings.connectionString,
    max: poolSettings.max,
    connectionTimeoutMillis: poolSettings.connectionTimeoutMillis,
    ...(poolSettings.ssl === undefined ? {} : { ssl: poolSettings.ssl }),
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: config.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

globalForPrisma.prisma = prisma;
globalForPrisma.pool = pool;
