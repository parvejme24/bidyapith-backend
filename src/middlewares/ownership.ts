import { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../shared/ApiError';
import { catchAsync } from '../shared/catchAsync';
import { prisma } from '../shared/prisma';

export type OwnershipResource =
  | 'enrollment'
  | 'enrollmentOffering'
  | 'offering'
  | 'exam'
  | 'invoice'
  | 'payment';

export const ownership = (resource: OwnershipResource) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    if (req.user === undefined) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Authentication required');
    }

    const id = req.params['id'];
    if (id === undefined || Array.isArray(id)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'id is required');
    }

    if (resource === 'enrollment') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { id },
        select: { id: true, studentId: true },
      });
      if (enrollment === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Enrollment not found');
      }
      if (req.user.studentProfileId !== enrollment.studentId) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Not your enrollment');
      }
      next();
      return;
    }

    if (resource === 'enrollmentOffering') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { id },
        select: {
          id: true,
          offering: { select: { instructorId: true } },
        },
      });
      if (enrollment === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Enrollment not found');
      }
      if (req.user.role === Role.ADMIN) {
        next();
        return;
      }
      if (req.user.instructorProfileId !== enrollment.offering.instructorId) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'You can only grade enrollments on your own offerings',
        );
      }
      next();
      return;
    }

    if (resource === 'invoice') {
      const invoice = await prisma.feeInvoice.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, studentId: true },
      });
      if (invoice === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Invoice not found');
      }
      if (req.user.role === Role.ADMIN) {
        next();
        return;
      }
      if (req.user.studentProfileId !== invoice.studentId) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Not your invoice');
      }
      next();
      return;
    }

    if (resource === 'payment') {
      const payment = await prisma.payment.findUnique({
        where: { id },
        select: { id: true, invoice: { select: { studentId: true } } },
      });
      if (payment === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Payment not found');
      }
      if (req.user.role === Role.ADMIN) {
        next();
        return;
      }
      if (req.user.studentProfileId !== payment.invoice.studentId) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'Not your payment');
      }
      next();
      return;
    }

    if (resource === 'exam') {
      const exam = await prisma.exam.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          offering: { select: { instructorId: true } },
        },
      });
      if (exam === null) {
        throw new ApiError(StatusCodes.NOT_FOUND, 'Exam not found');
      }
      if (req.user.role === Role.ADMIN) {
        next();
        return;
      }
      if (req.user.instructorProfileId !== exam.offering.instructorId) {
        throw new ApiError(
          StatusCodes.FORBIDDEN,
          'You can only manage exams for your own offerings',
        );
      }
      next();
      return;
    }

    const offering = await prisma.courseOffering.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, instructorId: true },
    });
    if (offering === null) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Offering not found');
    }

    if (req.user.role === Role.ADMIN) {
      next();
      return;
    }

    if (req.user.instructorProfileId !== offering.instructorId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You can only manage your own offerings');
    }

    next();
  });
