export class ApiError extends Error {
  readonly statusCode: number;
  readonly errors: { path: string; message: string }[] | undefined;
  readonly isOperational: boolean;

  constructor(statusCode: number, message: string, errors?: { path: string; message: string }[]) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.name = 'ApiError';
    if (errors !== undefined) {
      this.errors = errors;
    }
    Error.captureStackTrace(this, this.constructor);
  }
}
