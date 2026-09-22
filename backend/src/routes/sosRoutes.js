import { Router } from 'express';
import * as sosController from '../controllers/sosController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { sosLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();
router.use(authenticate);

router.post('/', sosLimiter, sosController.create);
router.post('/group', sosLimiter, sosController.createGroup);
router.get('/active', requireAdmin, sosController.listActive);
router.get('/history', sosController.listHistory);
router.patch('/:id/transition', sosController.transition);
router.patch('/:id/status', sosController.transition);
router.patch('/:id', sosController.transition);

export default router;
