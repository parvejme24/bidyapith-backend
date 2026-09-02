import { Role } from '@prisma/client';
import { Router } from 'express';
import { auth } from '../../middlewares/auth';
import { authorize } from '../../middlewares/authorize';
import { ownership } from '../../middlewares/ownership';
import { validateRequest } from '../../middlewares/validateRequest';
import { InvoiceController } from './invoice.controller';
import { InvoiceValidation } from './invoice.validation';

const router = Router();

router.get(
  '/my',
  auth,
  authorize(Role.STUDENT),
  validateRequest(InvoiceValidation.myList),
  InvoiceController.listMine,
);
router.get('/summary', auth, authorize(Role.ADMIN), InvoiceController.summary);
router.get(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(InvoiceValidation.list),
  InvoiceController.listAll,
);
router.post(
  '/generate',
  auth,
  authorize(Role.ADMIN),
  validateRequest(InvoiceValidation.generate),
  InvoiceController.generate,
);
router.post(
  '/',
  auth,
  authorize(Role.ADMIN),
  validateRequest(InvoiceValidation.create),
  InvoiceController.create,
);
router.patch(
  '/:id/waive',
  auth,
  authorize(Role.ADMIN),
  validateRequest(InvoiceValidation.waive),
  InvoiceController.waive,
);
router.patch(
  '/:id/cancel',
  auth,
  authorize(Role.ADMIN),
  validateRequest(InvoiceValidation.cancel),
  InvoiceController.cancel,
);
router.get(
  '/:id',
  auth,
  authorize(Role.STUDENT, Role.ADMIN),
  validateRequest(InvoiceValidation.idParam),
  ownership('invoice'),
  InvoiceController.getById,
);

export const InvoiceRoutes = router;
