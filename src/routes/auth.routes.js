import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { login, register, changePassword, forcePasswordChange } from '../controllers/auth.controller.js';
const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', requireAuth, changePassword);
router.post('/force-password-change', requireAuth, forcePasswordChange);

export default router;
