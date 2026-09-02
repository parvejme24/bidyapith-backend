import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { ownership } from '../../middlewares/ownership';
import { validateRequest } from '../../middlewares/validateRequest';
import { ResultController } from './result.controller';
import { ResultValidation } from './result.validation';

const offeringGradeRouter = Router();

offeringGradeRouter.get(
  '/:id/grades',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(ResultValidation.offeringId),
  ownership('offering'),
  ResultController.previewGrades,
);
offeringGradeRouter.post(
  '/:id/grades',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(ResultValidation.submit),
  ownership('offering'),
  ResultController.submitGrades,
);

const enrollmentGradeRouter = Router();

enrollmentGradeRouter.patch(
  '/:id/grade',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(ResultValidation.patch),
  ownership('enrollmentOffering'),
  ResultController.patchGrade,
);

const semesterResultRouter = Router();

semesterResultRouter.get(
  '/:id/results/readiness',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ResultValidation.semesterId),
  ResultController.getReadiness,
);
semesterResultRouter.post(
  '/:id/publish-results',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ResultValidation.semesterId),
  ResultController.publishResults,
);

const studentResultRouter = Router();

studentResultRouter.get(
  '/me/results',
  auth,
  authorize(Role.STUDENT),
  validateRequest(ResultValidation.myResults),
  ResultController.getMyResults,
);
studentResultRouter.get(
  '/me/transcript',
  auth,
  authorize(Role.STUDENT),
  ResultController.getMyTranscript,
);
studentResultRouter.get(
  '/:id/transcript',
  auth,
  authorize(Role.ADMIN),
  validateRequest(ResultValidation.studentId),
  ResultController.getTranscriptByStudentId,
);

export const OfferingGradeRoutes = offeringGradeRouter;
export const EnrollmentGradeRoutes = enrollmentGradeRouter;
export const SemesterResultRoutes = semesterResultRouter;
export const StudentResultRoutes = studentResultRouter;
