import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../shared/ApiError';
import { catchAsync } from '../../shared/catchAsync';
import { sendResponse } from '../../shared/sendResponse';
import { getPaymentGateway } from './gateway';
import type { GatewayEvent } from './gateway/gateway.interface';
import { PaymentService } from './payment.service';

const requireStudentProfileId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  if (req.user.studentProfileId === undefined) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Student profile not found');
  }
  return req.user.studentProfileId;
};

const requireUserId = (req: Request): string => {
  if (req.user === undefined) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
  }
  return req.user.userId;
};

const initiate = catchAsync(async (req: Request, res: Response) => {
  const data = await PaymentService.initiate(requireStudentProfileId(req), req.body.invoiceId);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Checkout session created',
    data,
  });
});

const webhook = catchAsync(async (req: Request, res: Response) => {
  const rawBody = req.body;
  const signatureHeader = req.headers['stripe-signature'];
  const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

  if (!Buffer.isBuffer(rawBody)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Webhook body must be the raw payload');
  }
  if (signature === undefined || signature.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Missing webhook signature');
  }

  let event: GatewayEvent;
  try {
    event = await getPaymentGateway().verifyWebhook(rawBody, signature);
  } catch (error) {
    console.error('[payment] invalid webhook signature', error);
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid webhook signature');
  }

  const data = await PaymentService.handleWebhook(event);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Webhook received',
    data,
  });
});

const verify = catchAsync(async (req: Request, res: Response) => {
  const data = await PaymentService.verify(
    requireStudentProfileId(req),
    String(req.params['transactionRef']),
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment status retrieved successfully',
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await PaymentService.listMine(
    requireStudentProfileId(req),
    req.query as Parameters<typeof PaymentService.listMine>[1],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payments retrieved successfully',
    meta,
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const data = await PaymentService.getById(String(req.params['id']));
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment retrieved successfully',
    data,
  });
});

const listAll = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await PaymentService.listAll(
    req.query as Parameters<typeof PaymentService.listAll>[0],
  );
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payments retrieved successfully',
    meta,
    data,
  });
});

const refund = catchAsync(async (req: Request, res: Response) => {
  const data = await PaymentService.refund(requireUserId(req), String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Payment refunded successfully',
    data,
  });
});

export const PaymentController = {
  initiate,
  webhook,
  verify,
  listMine,
  getById,
  listAll,
  refund,
};
