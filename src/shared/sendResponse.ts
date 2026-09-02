import type { Response } from 'express';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
};

type SendResponseOptions<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
};

export const sendResponse = <T>(res: Response, options: SendResponseOptions<T>): void => {
  const payload: {
    success: boolean;
    statusCode: number;
    message: string;
    meta?: PaginationMeta;
    data?: T;
  } = {
    success: options.success,
    statusCode: options.statusCode,
    message: options.message,
  };

  if (options.meta !== undefined) {
    payload.meta = options.meta;
  }

  if (options.data !== undefined) {
    payload.data = options.data;
  }

  res.status(options.statusCode).json(payload);
};
