import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { catchAsync } from '../shared/catchAsync';

export const validateRequest = (schema: ZodType) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
      cookies: req.cookies,
    });

    if (typeof parsed === 'object' && parsed !== null) {
      const value = parsed as { body?: unknown; query?: unknown; params?: unknown };
      if (value.body !== undefined) {
        req.body = value.body;
      }
      if (value.query !== undefined) {
        req.query = value.query as Request['query'];
      }
      if (value.params !== undefined) {
        req.params = value.params as Request['params'];
      }
    }

    next();
  });
