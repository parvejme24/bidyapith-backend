import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { SemesterController } from './semester.controller';
import { SemesterValidation } from './semester.validation';

const router = Router();

router.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(SemesterValidation.create),
  SemesterController.create,
);
router.get('/', auth, validateRequest(SemesterValidation.list), SemesterController.list);
router.get('/current', auth, SemesterController.getCurrent);
router.get('/:id', auth, validateRequest(SemesterValidation.idParam), SemesterController.getById);
router.patch(
  '/:id/status',
  auth,
  authorize(Role.ADMIN),
  validateRequest(SemesterValidation.changeStatus),
  SemesterController.changeStatus,
);
router.patch(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(SemesterValidation.update),
  SemesterController.update,
);
router.delete(
  '/:id',
  auth,
  authorize(Role.ADMIN),
  validateRequest(SemesterValidation.idParam),
  SemesterController.remove,
);

export const SemesterRoutes = router;
