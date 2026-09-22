import { Router } from 'express';
import * as reportController from '../controllers/reportController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

const router = Router();
router.use(authenticate);

router.post('/', reportController.createReport);
router.get('/mine', reportController.listMyReports);
router.get('/', requireAdmin, reportController.adminList);
router.get('/:id', requireAdmin, reportController.adminDetail);
router.patch('/:id/status', requireAdmin, reportController.adminUpdateStatus);

export default router;
