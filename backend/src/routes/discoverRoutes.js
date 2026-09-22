import { Router } from 'express';
import * as discoverController from '../controllers/discoverController.js';

const router = Router();

router.get('/theatres/:id/shows', discoverController.shows);
router.get('/:type/:id', discoverController.detail);
router.get('/:type', discoverController.list);

export default router;
