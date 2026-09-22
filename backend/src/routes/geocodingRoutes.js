// =============================================================================
// geocodingRoutes.js — Free Open Geocoding & Address Suggestions.
// =============================================================================

import { Router } from 'express';
import * as geocodingController from '../controllers/geocodingController.js';

const router = Router();

router.get('/search', geocodingController.search);
router.get('/autocomplete', geocodingController.search);
router.get('/forward', geocodingController.geocode);
router.get('/reverse', geocodingController.reverseGeocode);
router.get('/', geocodingController.search);

export default router;
