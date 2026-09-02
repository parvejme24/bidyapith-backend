import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import multer, { MulterError } from 'multer';
import { ApiError } from '../shared/ApiError';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Avatar must be a JPEG, PNG, or WebP image'));
  },
}).single('avatar');

export const uploadAvatar = (req: Request, res: Response, next: NextFunction): void => {
  avatarUpload(req, res, (err: unknown) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Avatar must be 2 MB or smaller'));
        return;
      }
      next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, err.message));
      return;
    }
    if (err instanceof ApiError) {
      next(err);
      return;
    }
    if (err instanceof Error) {
      next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, err.message));
      return;
    }
    if (req.file === undefined) {
      next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, 'Avatar file is required'));
      return;
    }
    next();
  });
};
