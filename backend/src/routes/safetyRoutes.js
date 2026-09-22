import { Router } from 'express';
import * as safetyController from '../controllers/safetyController.js';

const router = Router();

router.get('/safety/map', safetyController.safetyMap);
router.post('/safety/guide', safetyController.guide);
router.get('/emergency/nearest', safetyController.nearest);

export default router;
