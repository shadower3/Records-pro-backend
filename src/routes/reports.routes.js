import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { 
  getDashboardStats, 
  getPatientReport, 
  getUserActivityReport, 
  exportPatientData 
} from '../controllers/reports.controller.js';

const router = Router();

// Dashboard statistics - accessible to all authenticated users
router.get('/dashboard', requireAuth, getDashboardStats);

// Patient reports - accessible to doctors and admins
router.get('/patients', requireAuth, requireRole(['admin', 'doctor']), getPatientReport);

// User activity reports - admin only
router.get('/users', requireAuth, requireRole(['admin']), getUserActivityReport);

// Export functionality - admin only
router.get('/export/patients', requireAuth, requireRole(['admin']), exportPatientData);

export default router;
