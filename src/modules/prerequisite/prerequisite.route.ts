import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { validateRequest } from '../../middlewares/validateRequest';
import { PrerequisiteController } from './prerequisite.controller';
import { PrerequisiteValidation } from './prerequisite.validation';

const router = Router();

router.post(
  '/:id/prerequisites',
  auth,
  authorize(Role.ADMIN),
  validateRequest(PrerequisiteValidation.create),
  PrerequisiteController.create,
);
router.get(
  '/:id/prerequisites',
  auth,
  validateRequest(PrerequisiteValidation.idParam),
  PrerequisiteController.tree,
);
router.get(
  '/:id/dependents',
  auth,
  validateRequest(PrerequisiteValidation.idParam),
  PrerequisiteController.dependents,
);
router.delete(
  '/:id/prerequisites/:prerequisiteId',
  auth,
  authorize(Role.ADMIN),
  validateRequest(PrerequisiteValidation.deleteParam),
  PrerequisiteController.remove,
);

export const PrerequisiteRoutes = router;
