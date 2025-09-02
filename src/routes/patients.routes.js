import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { list, create, getById, update, deletePatient } from '../controllers/patients.controller.js';
const router = Router();

router.get('/', requireAuth, list);
router.post('/', requireAuth, create);
router.get('/:id', requireAuth, getById);
router.put('/:id', requireAuth, update);
router.delete('/:id', requireAuth, deletePatient);

export default router;
