import { Router } from 'express';
import * as locationController from '../controllers/locationController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authenticate);

// Individual tourist live location endpoints
router.get('/current', locationController.getCurrentLocation);
router.post('/update', locationController.updateCurrentLocation);
router.get('/history', locationController.getLocationHistory);

// Group sharing endpoints
router.post('/:groupId/start', locationController.startSharing);
router.post('/:groupId/stop', locationController.stopSharing);

export default router;
