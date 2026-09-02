import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { config } from '../config';
import { ApiError } from './ApiError';

type ErrorEnvelope = {
  success: false;
  statusCode: number;
  message: string;
  errors?: { path: string; message: string }[];
  stack?: string;
};

const formatZodPath = (path: PropertyKey[]): string =>
  path.filter((segment) => segment !== 'body' && segment !== 'cookies').join('.') ||
  'body';

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = 'Something went wrong';
  let errors: { path: string; message: string }[] | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof ZodError) {
    statusCode = StatusCodes.UNPROCESSABLE_ENTITY;
    message = 'Validation error';
    errors = err.issues.map((issue) => ({
      path: formatZodPath(issue.path),
      message: issue.message,
    }));
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = StatusCodes.CONFLICT;
      const target = Array.isArray(err.meta?.['target'])
        ? (err.meta['target'] as string[]).join(', ')
        : 'field';
      message = `A record with this ${target} already exists`;
      errors = [{ path: target, message }];
    } else if (err.code === 'P2025') {
      statusCode = StatusCodes.NOT_FOUND;
      message = 'Record not found';
    }
  } else if (err instanceof Error) {
    message = err.message;
  }

  const payload: ErrorEnvelope = {
    success: false,
    statusCode,
    message,
  };

  if (errors !== undefined) {
    payload.errors = errors;
  }

  if (
    config.NODE_ENV === 'development' &&
    statusCode >= 500 &&
    err instanceof Error &&
    err.stack !== undefined
  ) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};
