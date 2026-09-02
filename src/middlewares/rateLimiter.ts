import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../shared/ApiError';

const emailFromBody = (req: Request): string => {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : 'unknown';
};

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? 'unknown')}:${emailFromBody(req)}`,
  handler: (_req, _res, next) => {
    next(
      new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        'Too many login attempts. Please try again in 15 minutes.',
      ),
    );
  },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => emailFromBody(req),
  handler: (_req, _res, next) => {
    next(
      new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        'Too many password reset requests. Please try again in an hour.',
      ),
    );
  },
});
