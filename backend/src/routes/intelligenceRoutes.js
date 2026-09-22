import { Router } from 'express';
import * as intelligenceController from '../controllers/intelligenceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';
import { intelligenceLimiter } from '../middleware/rateLimitMiddleware.js';

const router = Router();

// ML / intelligence endpoints — require a valid JWT (the frontend always holds
// one for these features). Rate-limited to protect the (optional) ML service.
router.use(authenticate);

router.post('/fare/predict', intelligenceLimiter, intelligenceController.farePredict);
router.post('/safety/predict', intelligenceLimiter, intelligenceController.safetyPredict);
router.get('/recommendations', intelligenceController.recommendations);
router.get('/emergency/nearest', intelligenceController.emergencyNearest);
router.post('/route', intelligenceLimiter, intelligenceController.route);
router.post('/packing', intelligenceController.packing);
router.post('/trip/optimize', intelligenceController.tripOptimize);
router.post('/feedback', intelligenceController.feedback);

// Model registry — admin only.
router.get('/models', requireAdmin, intelligenceController.models);

export default router;
