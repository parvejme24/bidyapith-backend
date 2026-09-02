import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { DepartmentService } from './department.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await DepartmentService.create(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Department created successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await DepartmentService.list(
    req.query as Parameters<typeof DepartmentService.list>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Departments retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await DepartmentService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Department retrieved successfully',
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await DepartmentService.update(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Department updated successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await DepartmentService.softDelete(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Department deleted successfully',
    data,
  });
});

export const DepartmentController = {
  create,
  list,
  getById,
  update,
  remove,
};
