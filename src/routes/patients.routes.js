import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  list,
  create,
  getById,
  update,
  updatePatientDetails,
  updateMedicalRecords,
  updateVitalSigns,
  updatePatientStatus,
  deletePatient
} from '../controllers/patients.controller.js';
const router = Router();

router.get('/', requireAuth, list);
router.post('/', requireAuth, create);
router.get('/:id', requireAuth, getById);
router.put('/:id', requireAuth, update);
router.put('/:id/details', requireAuth, updatePatientDetails);
router.put('/:id/medical', requireAuth, updateMedicalRecords);
router.put('/:id/vitals', requireAuth, updateVitalSigns);
router.put('/:id/status', requireAuth, updatePatientStatus);
router.delete('/:id', requireAuth, requireRole(['admin']), deletePatient);

export default router;
