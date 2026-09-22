import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { loginLimiter, registerLimiter, otpLimiter } from '../middleware/rateLimitMiddleware.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', registerLimiter, authController.register);
router.post('/register/request-otp', registerLimiter, authController.requestOTP);
router.post('/register/verify-otp', otpLimiter, authController.verifyOTP);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', loginLimiter, authController.forgotPassword);
router.get('/verify-reset-token', authController.verifyResetToken);
router.post('/reset-password', loginLimiter, authController.resetPassword);
router.get('/dev-mail-preview', authController.getDevMailPreview);
router.get('/me', authenticate, authController.me);
router.patch('/profile/avatar', authenticate, authController.updateAvatar);
router.delete('/profile/avatar', authenticate, authController.removeAvatar);
router.get('/notifications', authenticate, authController.getNotifications);
router.post('/change-password', authenticate, loginLimiter, authController.changePassword);

export default router;
