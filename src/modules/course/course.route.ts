import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { CourseController } from './course.controller';
import { CourseValidation } from './course.validation';

const router = Router();

router.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(CourseValidation.create),
  CourseController.create,
);
router.get('/', auth, validateRequest(CourseValidation.list), CourseController.list);
router.get('/:id', auth, validateRequest(CourseValidation.idParam), CourseController.getById);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(CourseValidation.update),
  CourseController.update,
);
router.delete(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(CourseValidation.idParam),
  CourseController.remove,
);

export const CourseRoutes = router;
