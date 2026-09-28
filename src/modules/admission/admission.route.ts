import { Router } from 'express';
import { AdmissionController } from './admission.controller';

const router = Router();

router.get('/', AdmissionController.getAll);
router.get('/me', AdmissionController.getMyApplications);
router.get('/:id', AdmissionController.getById);
router.post('/', AdmissionController.create);
router.patch('/:id/approve', AdmissionController.approve);
router.patch('/:id/reject', AdmissionController.reject);
router.post('/:id/pay', AdmissionController.payFee);

export const AdmissionRoutes = router;
