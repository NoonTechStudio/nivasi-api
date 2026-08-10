import { Router } from 'express';
import {
  listDomesticHelp,
  addDomesticHelp,
  updateDomesticHelp,
  deleteDomesticHelp,
} from '../controllers/domesticHelp.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard);

// Residents manage their own flat's staff; Secretary gets read access across the wing.
router.get('/', requireRole('RESIDENT', 'WING_ADMIN'), listDomesticHelp);
router.post('/', requireRole('RESIDENT'), addDomesticHelp);
router.put('/:id', requireRole('RESIDENT'), updateDomesticHelp);
router.delete('/:id', requireRole('RESIDENT'), deleteDomesticHelp);

export default router;
