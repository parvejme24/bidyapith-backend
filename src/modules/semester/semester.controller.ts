import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { SemesterService } from './semester.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await SemesterService.create(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Semester created successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await SemesterService.list(
    req.query as Parameters<typeof SemesterService.list>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semesters retrieved successfully',
    meta,
    data,
  });
});

const getCurrent = catchAsync(async (_req: Request, res: Response) => {
  const data = await SemesterService.getCurrent();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Current semester retrieved successfully',
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await SemesterService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester retrieved successfully',
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await SemesterService.update(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester updated successfully',
    data,
  });
});

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const data = await SemesterService.changeStatus(
    requireUserId(req),
    String(req.params['id']),
    req.body.status,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester status updated successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await SemesterService.softDelete(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Semester deleted successfully',
    data,
  });
});

export const SemesterController = {
  create,
  list,
  getCurrent,
  getById,
  update,
  changeStatus,
  remove,
};
