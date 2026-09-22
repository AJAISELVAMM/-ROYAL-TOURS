import { Router } from 'express';
import * as tripController from '../controllers/tripController.js';
import * as groupController from '../controllers/groupController.js';
import * as budgetController from '../controllers/budgetController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();
router.use(authenticate);

router.post('/join', groupController.joinGroup);
router.post('/', tripController.createTrip);
router.get('/', tripController.listTrips);
router.get('/:id/budget', budgetController.getBudget);
router.post('/:id/budget/expenses', budgetController.createExpense);
router.put('/:id/budget/expenses/:expenseId', budgetController.updateExpense);
router.delete('/:id/budget/expenses/:expenseId', budgetController.deleteExpense);
router.get('/:id', tripController.getTrip);
router.get('/:id/packing', tripController.getPacking);
router.patch('/:id/packing/:itemId', tripController.togglePackingItem);
router.post('/:id/replan', tripController.replanTrip);
router.post('/:id/itinerary', tripController.addActivity);
router.post('/:id/invitations/accept', tripController.acceptInvitation);
router.post('/:id/invitations/reject', tripController.rejectInvitation);
router.post('/:id/leave', groupController.leaveGroup);

export default router;
