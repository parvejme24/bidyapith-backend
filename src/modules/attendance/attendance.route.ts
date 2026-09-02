import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { ownership } from '../../middlewares/ownership';
import { validateRequest } from '../../middlewares/validateRequest';
import { AttendanceController } from './attendance.controller';
import { AttendanceValidation } from './attendance.validation';

const offeringAttendanceRouter = Router();

offeringAttendanceRouter.get(
  '/:id/attendance/summary',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(AttendanceValidation.offeringId),
  ownership('offering'),
  AttendanceController.getSummary,
);
offeringAttendanceRouter.post(
  '/:id/attendance',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(AttendanceValidation.mark),
  ownership('offering'),
  AttendanceController.mark,
);
offeringAttendanceRouter.get(
  '/:id/attendance',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(AttendanceValidation.byDate),
  ownership('offering'),
  AttendanceController.getSession,
);
offeringAttendanceRouter.delete(
  '/:id/attendance',
  auth,
  authorize(Role.ADMIN),
  validateRequest(AttendanceValidation.byDate),
  AttendanceController.removeSession,
);

const studentAttendanceRouter = Router();

studentAttendanceRouter.get(
  '/me/attendance',
  auth,
  authorize(Role.STUDENT),
  AttendanceController.getMine,
);

export const OfferingAttendanceRoutes = offeringAttendanceRouter;
export const StudentAttendanceRoutes = studentAttendanceRouter;
