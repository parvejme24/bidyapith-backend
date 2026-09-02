import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { ProgramService } from './program.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.create(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Program created successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await ProgramService.list(
    req.query as Parameters<typeof ProgramService.list>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Programs retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Program retrieved successfully',
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.update(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Program updated successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.softDelete(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Program deleted successfully',
    data,
  });
});

const curriculum = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.getCurriculum(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculum retrieved successfully',
    data,
  });
});

const addCourse = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.addCourse(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Course added to curriculum',
    data,
  });
});

const patchCourse = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.patchCourse(
    requireUserId(req),
    String(req.params['id']),
    String(req.params['courseId']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Curriculum entry updated successfully',
    data,
  });
});

const removeCourse = catchAsync(async (req: Request, res: Response) => {
  const data = await ProgramService.removeCourse(
    requireUserId(req),
    String(req.params['id']),
    String(req.params['courseId']),
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Course removed from curriculum',
    data,
  });
});

export const ProgramController = {
  create,
  list,
  getById,
  update,
  remove,
  curriculum,
  addCourse,
  patchCourse,
  removeCourse,
};
