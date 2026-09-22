import { Router } from 'express';
import * as transportController from '../controllers/transportController.js';
import { routeLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();

router.get('/transport/routes', routeLimiter, transportController.getRoutes);
router.get('/routes', routeLimiter, transportController.getRoutes);
router.post('/routes', routeLimiter, transportController.postRoute);
router.get('/navigation/route', routeLimiter, transportController.getRoutes);
router.post('/navigation/route', routeLimiter, transportController.postRoute);
router.get('/transport/options', transportController.listOptions);
router.get('/fare/estimate', transportController.estimateFare);
router.post('/fare/check', transportController.checkFare);

export default router;
