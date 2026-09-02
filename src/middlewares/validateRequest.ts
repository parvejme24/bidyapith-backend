import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { catchAsync } from '../shared/catchAsync';

const replaceRequestField = (req: Request, field: 'query' | 'params', value: unknown): void => {
  Object.defineProperty(req, field, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

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
        replaceRequestField(req, 'query', value.query);
      }
      if (value.params !== undefined) {
        replaceRequestField(req, 'params', value.params);
      }
    }

    next();
  });
