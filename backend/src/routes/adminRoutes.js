import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/roleMiddleware.js';

import * as sosController from '../controllers/sosController.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/sos', sosController.listActive);
router.patch('/sos/:id', sosController.transition);
router.get('/overview', adminController.overview);
router.get('/analytics', adminController.analytics);
router.get('/users', adminController.listUsers);
router.get('/users/:id', adminController.userDetail);
router.patch('/users/:id/status', adminController.updateUserStatus);

router.post('/catalog/:type', adminController.createCatalog);
router.patch('/catalog/:type/:id', adminController.updateCatalog);
router.delete('/catalog/:type/:id', adminController.deleteCatalog);
router.patch('/catalog/:type/:id/verify', adminController.verifyCatalog);

router.get('/safety', adminController.safetyCenter);
router.get('/contacts', adminController.listEmergencyContacts);
router.post('/contacts', adminController.createEmergencyContact);
router.patch('/contacts/:id', adminController.updateEmergencyContact);
router.delete('/contacts/:id', adminController.deleteEmergencyContact);

router.get('/services', adminController.serviceStatus);
router.get('/account', adminController.account);
router.post('/password', adminController.changePassword);
router.get('/activity-logs', adminController.activityLogs);

export default router;
