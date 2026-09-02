import type { Response } from 'express';

type SendResponseOptions<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
};

export const sendResponse = <T>(res: Response, options: SendResponseOptions<T>): void => {
  const payload: {
    success: boolean;
    statusCode: number;
    message: string;
    data?: T;
  } = {
    success: options.success,
    statusCode: options.statusCode,
    message: options.message,
  };

  if (options.data !== undefined) {
    payload.data = options.data;
  }

  res.status(options.statusCode).json(payload);
};
