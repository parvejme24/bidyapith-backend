import type { RequestHandler } from 'express';

const SLOW_MS = 300;

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms > SLOW_MS) {
      console.warn(`⚠️  ${req.method} ${req.originalUrl} ${ms.toFixed(0)}ms`);
    }
  });
  next();
};
