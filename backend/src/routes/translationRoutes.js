import { Router } from 'express';
import * as translationController from '../controllers/translationController.js';
import { translationLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.post('/translate', translationLimiter, translationController.translate);
router.get('/languages', translationController.languages);

export default router;
