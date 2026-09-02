import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { ownership } from '../../middlewares/ownership';
import { validateRequest } from '../../middlewares/validateRequest';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentValidation } from './enrollment.validation';

const enrollmentRouter = Router();

enrollmentRouter.post(
  '/',
  auth,
  authorize(Role.STUDENT),
  validateRequest(EnrollmentValidation.create),
  EnrollmentController.create,
);
enrollmentRouter.post(
  '/admin',
  auth,
  authorize(Role.ADMIN),
  validateRequest(EnrollmentValidation.adminCreate),
  EnrollmentController.createAdmin,
);
enrollmentRouter.get(
  '/my-courses',
  auth,
  authorize(Role.STUDENT),
  validateRequest(EnrollmentValidation.myCourses),
  EnrollmentController.listMine,
);
enrollmentRouter.get(
  '/available-courses',
  auth,
  authorize(Role.STUDENT),
  validateRequest(EnrollmentValidation.availableCourses),
  EnrollmentController.listAvailable,
);
enrollmentRouter.get(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(EnrollmentValidation.list),
  EnrollmentController.listAll,
);
enrollmentRouter.delete(
  '/:id',
  auth,
  authorize(Role.STUDENT),
  validateRequest(EnrollmentValidation.idParam),
  ownership('enrollment'),
  EnrollmentController.drop,
);

const offeringRosterRouter = Router();

offeringRosterRouter.get(
  '/:id/students',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(EnrollmentValidation.roster),
  ownership('offering'),
  EnrollmentController.listRoster,
);

export const EnrollmentRoutes = enrollmentRouter;
export const OfferingRosterRoutes = offeringRosterRouter;
