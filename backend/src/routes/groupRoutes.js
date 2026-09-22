import { Router } from 'express';
import * as groupController from '../controllers/groupController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authenticate);

router.get('/', groupController.listActiveGroups);
router.post('/', groupController.createGroup);
router.post('/join', groupController.joinGroup);
router.get('/:groupId', groupController.getGroup);
router.get('/:groupId/members', groupController.getMembers);
router.post('/:groupId/call', groupController.callMember);
router.post('/:groupId/leave', groupController.leaveGroup);

export default router;
