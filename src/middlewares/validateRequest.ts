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

    if (typeof parsed === 'object' && parsed !== null && 'body' in parsed) {
      const body = (parsed as { body: unknown }).body;
      if (body !== undefined) {
        req.body = body;
      }
    }

    next();
  });
