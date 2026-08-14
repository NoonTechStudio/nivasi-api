import { Router } from 'express';
import { listFamilyMembers, addFamilyMember, removeFamilyMember } from '../controllers/familyMember.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard, requireRole('RESIDENT'));

router.get('/', listFamilyMembers);
router.post('/', addFamilyMember);
router.delete('/:id', removeFamilyMember);

export default router;
