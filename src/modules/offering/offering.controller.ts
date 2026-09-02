import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { OfferingService } from './offering.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.create(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Offering created successfully',
    data,
  });
});

const list = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await OfferingService.list(
    req.query as Parameters<typeof OfferingService.list>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offerings retrieved successfully',
    meta,
    data,
  });
});

const listMyTeaching = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await OfferingService.listMyTeaching(
    requireUserId(req),
    req.query as Parameters<typeof OfferingService.listMyTeaching>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Teaching offerings retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offering retrieved successfully',
    data,
  });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.update(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offering updated successfully',
    data,
  });
});

const assignInstructor = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.assignInstructor(
    requireUserId(req),
    String(req.params['id']),
    req.body.instructorId,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Instructor assigned successfully',
    data,
  });
});

const changeStatus = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.changeStatus(
    requireUserId(req),
    String(req.params['id']),
    req.body.status,
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offering status updated successfully',
    data,
  });
});

const addSchedule = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.addSchedule(
    requireUserId(req),
    String(req.params['id']),
    req.body,
  );
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Schedule slot added successfully',
    data,
  });
});

const removeSchedule = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.removeSchedule(
    requireUserId(req),
    String(req.params['id']),
    String(req.params['scheduleId']),
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Schedule slot removed successfully',
    data,
  });
});

const remove = catchAsync(async (req: Request, res: Response) => {
  const data = await OfferingService.softDelete(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Offering cancelled successfully',
    data,
  });
});

export const OfferingController = {
  create,
  list,
  listMyTeaching,
  getById,
  update,
  assignInstructor,
  changeStatus,
  addSchedule,
  removeSchedule,
  remove,
};
