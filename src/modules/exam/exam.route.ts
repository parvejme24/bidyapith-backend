import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { ownership } from '../../middlewares/ownership';
import { validateRequest } from '../../middlewares/validateRequest';
import { ExamController } from './exam.controller';
import { ExamValidation } from './exam.validation';

const offeringExamRouter = Router();

offeringExamRouter.post(
  '/:id/exams',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(ExamValidation.create),
  ownership('offering'),
  ExamController.create,
);
offeringExamRouter.get(
  '/:id/exams',
  auth,
  validateRequest(ExamValidation.offeringList),
  ExamController.listByOffering,
);

const examRouter = Router();

examRouter.patch(
  '/:id/publish',
  auth,
  authorize(Role.INSTRUCTOR),
  validateRequest(ExamValidation.publish),
  ownership('exam'),
  ExamController.publish,
);
examRouter.post(
  '/:id/results',
  auth,
  authorize(Role.INSTRUCTOR),
  validateRequest(ExamValidation.results),
  ownership('exam'),
  ExamController.enterResults,
);
examRouter.get(
  '/:id/results',
  auth,
  authorize(Role.INSTRUCTOR, Role.ADMIN),
  validateRequest(ExamValidation.resultsList),
  ownership('exam'),
  ExamController.listResults,
);
examRouter.patch(
  '/:id',
  auth,
  authorize(Role.INSTRUCTOR),
  validateRequest(ExamValidation.update),
  ownership('exam'),
  ExamController.update,
);
examRouter.delete(
  '/:id',
  auth,
  authorize(Role.INSTRUCTOR),
  validateRequest(ExamValidation.idParam),
  ownership('exam'),
  ExamController.remove,
);

const studentExamRouter = Router();

studentExamRouter.get(
  '/me/exam-results',
  auth,
  authorize(Role.STUDENT),
  validateRequest(ExamValidation.myResults),
  ExamController.listMine,
);

export const OfferingExamRoutes = offeringExamRouter;
export const ExamRoutes = examRouter;
export const StudentExamResultRoutes = studentExamRouter;
