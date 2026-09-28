import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { AdmissionService } from './admission.service';

const getAll = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as { status?: string; type?: string; search?: string };
  const result = await AdmissionService.getAll(query);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Admissions and course applications retrieved successfully',
    data: result,
  });
});

const getMyApplications = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email;
  const result = await AdmissionService.getMyApplications(email);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'My applications retrieved successfully',
    data: result,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const result = await AdmissionService.getById(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Application details retrieved successfully',
    data: result,
  });
});

const create = catchAsync(async (req: Request, res: Response) => {
  const result = await AdmissionService.create(req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Application submitted successfully',
    data: result,
  });
});

const approve = catchAsync(async (req: Request, res: Response) => {
  const result = await AdmissionService.approve(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Application verified and approved successfully',
    data: result,
  });
});

const reject = catchAsync(async (req: Request, res: Response) => {
  const result = await AdmissionService.reject(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Application marked as rejected',
    data: result,
  });
});

const payFee = catchAsync(async (req: Request, res: Response) => {
  const result = await AdmissionService.markPaid(req.params.id as string);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Admission fee payment confirmed and enrolled',
    data: result,
  });
});

export const AdmissionController = {
  getAll,
  getMyApplications,
  getById,
  create,
  approve,
  reject,
  payFee,
};
