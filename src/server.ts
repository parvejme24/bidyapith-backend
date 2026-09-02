import type { Server } from 'node:http';
import { app } from './app';
import { config } from './config';
import { startExpireStalePaymentsJob } from './jobs/expireStalePayments';
import { prisma } from './shared/prisma';
import { disconnectRedis } from './shared/redis';
import { initMailer } from './utils/sendEmail';

const HOST = '0.0.0.0';

const log = (message: string): void => {
  console.log(`> ${message}`);
};

const printStartupBanner = (mailStatus: 'ok' | 'skipped' | 'failed'): void => {
  log(`Server is running at http://localhost:${config.PORT}`);
  log('Database connection successful');

  if (mailStatus === 'ok') {
    log('Nodemailer connection successful');
  } else if (mailStatus === 'skipped') {
    log('Nodemailer skipped (SMTP not configured)');
  } else {
    log('Nodemailer connection failed');
  }

  if (mailStatus !== 'failed') {
    log('All is OK');
  }
};

const start = async (): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    console.error('> Database connection failed', error);
    process.exit(1);
  }

  const mailStatus = await initMailer();
  if (mailStatus === 'failed') {
    console.error('> Nodemailer could not verify the SMTP server');
  }

  const server: Server = app.listen(config.PORT, HOST, () => {
    printStartupBanner(mailStatus);
  });
  // Long-running hosts (Render, local). Serverless platforms skip listen() and the interval job.
  if (process.env['VERCEL'] !== '1') {
    startExpireStalePaymentsJob();
  }

  const shutdown = async (signal: string): Promise<void> => {
    log(`${signal} received. Closing server.`);
    server.close(async () => {
      await prisma.$disconnect();
      await disconnectRedis();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('> Unhandled rejection', reason);
    server.close(() => process.exit(1));
  });
};

if (process.env['VERCEL'] !== '1') {
  void start();
}

export { app };
export default app;
