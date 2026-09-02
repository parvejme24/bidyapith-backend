import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { CourseService } from './course.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await CourseService.create(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Course created successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await CourseService.list(
    req.query as Parameters<typeof CourseService.list>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Courses retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await CourseService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Course retrieved successfully',
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await CourseService.update(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Course updated successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await CourseService.softDelete(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Course deleted successfully',
    data,
  });
});

export const CourseController = {
  create,
  list,
  getById,
  update,
  remove,
};
