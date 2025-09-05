import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
  updateProfile,
  updateSettings,
  getCurrentUser
} from '../controllers/users.controller.js';

const router = Router();

// Current user routes (accessible to authenticated users) - MUST come before /:id routes
router.get('/me', requireAuth, getCurrentUser);
router.put('/me/profile', requireAuth, updateProfile);
router.put('/me/settings', requireAuth, updateSettings);

// Admin-only user management routes - these come after specific routes
router.get('/', requireAuth, requireRole(['admin']), getUsers);
router.post('/', requireAuth, requireRole(['admin']), createUser);
router.put('/:id', requireAuth, requireRole(['admin']), updateUser);
router.put('/:id/reset-password', requireAuth, requireRole(['admin']), resetUserPassword);
router.delete('/:id', requireAuth, requireRole(['admin']), deleteUser);

export default router;
