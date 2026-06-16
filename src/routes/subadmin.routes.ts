import { Router } from 'express';
import {
  getAll, getHierarchy, create, update, deactivate,
  getSocieties, assignSociety, unassignSociety,
} from '../controllers/subadmin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('SUPER_ADMIN'), getAll);
router.get('/hierarchy', requireRole('SUPER_ADMIN'), getHierarchy);
router.post('/', requireRole('SUPER_ADMIN'), create);
router.put('/:id', update);
router.delete('/:id', requireRole('SUPER_ADMIN'), deactivate);
router.get('/:id/societies', getSocieties);
router.post('/:id/assign-society', requireRole('SUPER_ADMIN'), assignSociety);
router.delete('/societies/:societyId/unassign', requireRole('SUPER_ADMIN'), unassignSociety);

export default router;
