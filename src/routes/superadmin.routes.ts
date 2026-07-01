import { Router } from 'express';
import {
  getStats,
  getSocieties, createSociety, updateSociety, deleteSociety,
  createWing, getWingDetail, deleteWing,
  createFlatInWing,
  setWingSecretary,
  getWingResidents,
  getFlatDetail,
  addResidentToFlat,
  removeResidentAdmin,
} from '../controllers/superadmin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/roleGuard';

const router = Router();
router.use(authenticate, requireRole('SUPER_ADMIN'));

// Stats
router.get('/stats', getStats);

// Societies
router.get('/societies', getSocieties);
router.post('/societies', createSociety);
router.put('/societies/:id', updateSociety);
router.delete('/societies/:id', deleteSociety);

// Wings
router.post('/wings', createWing);
router.get('/wings/:id', getWingDetail);
router.delete('/wings/:wingId', deleteWing);
router.post('/wings/:wingId/flats', createFlatInWing);
router.post('/wings/:wingId/secretary', setWingSecretary);
router.get('/wings/:wingId/residents', getWingResidents);

// Flats
router.get('/flats/:flatId', getFlatDetail);
router.post('/flats/:flatId/residents', addResidentToFlat);

// Residents
router.delete('/residents/:id', removeResidentAdmin);

export default router;
