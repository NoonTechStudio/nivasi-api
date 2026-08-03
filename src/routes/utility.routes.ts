import { Router } from 'express';
import {
  listUtilities,
  getUtilityDetail,
  createUtility,
  updateUtility,
  deleteUtility,
  logUtilityCompletion,
  getUtilityLogs,
} from '../controllers/utility.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';
import { wingGuard } from '../middleware/wingGuard';

const router = Router();
router.use(authenticate, wingGuard, requireRole('WING_ADMIN'));

router.get('/', listUtilities);
router.get('/:id', getUtilityDetail);
router.post('/', createUtility);
router.put('/:id', updateUtility);
router.delete('/:id', deleteUtility);
router.post('/:id/logs', logUtilityCompletion);
router.get('/:id/logs', getUtilityLogs);

export default router;
