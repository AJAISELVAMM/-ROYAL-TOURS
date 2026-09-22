// =============================================================================
// facilityRoutes.js — Routes for unified facilities & multi-source queries.
// =============================================================================

import { Router } from 'express';
import * as facilityController from '../controllers/facilityController.js';

const router = Router();

router.get('/nearby', facilityController.nearby);
router.get('/categories', facilityController.categories);
router.get('/providers/status', facilityController.status);

export default router;
