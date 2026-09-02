import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { InvoiceService } from './invoice.service';

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const requireStudentProfileId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  if (req.user.studentProfileId === undefined) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student profile not found');
  }
  return req.user.studentProfileId;
};

const listMine = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await InvoiceService.listMine(
    requireStudentProfileId(req),
    req.query as Parameters<typeof InvoiceService.listMine>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoices retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await InvoiceService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoice retrieved successfully',
    data,
  });
});

const listAll = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await InvoiceService.listAll(
    req.query as Parameters<typeof InvoiceService.listAll>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoices retrieved successfully',
    meta,
    data,
  });
});

const create = catchAsync(async (req: Request, res: Response) => {
  const data = await InvoiceService.create(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Invoice issued successfully',
    data,
  });
});

const generate = catchAsync(async (req: Request, res: Response) => {
  const data = await InvoiceService.generateRegistrationInvoices(requireUserId(req), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Registration invoices generated',
    data,
  });
});

const waive = catchAsync(async (req: Request, res: Response) => {
  const data = await InvoiceService.waive(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoice waived successfully',
    data,
  });
});

const cancel = catchAsync(async (req: Request, res: Response) => {
  const data = await InvoiceService.cancel(requireUserId(req), String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoice cancelled successfully',
    data,
  });
});

const summary = catchAsync(async (_req: Request, res: Response) => {
  const data = await InvoiceService.summary();
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Invoice summary retrieved successfully',
    data,
  });
});

export const InvoiceController = {
  listMine,
  getById,
  listAll,
  create,
  generate,
  waive,
  cancel,
  summary,
};
