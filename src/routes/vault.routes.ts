import { Router } from 'express';
import {
  listVaultDocuments,
  uploadVaultDocument,
  getVaultDocumentUrl,
  deleteVaultDocument,
} from '../controllers/vault.controller';
import { authenticate } from '../middleware/auth.middleware';
import { handleSingleUpload } from '../middleware/upload.middleware';

const router = Router();
router.use(authenticate);

router.get('/', listVaultDocuments);
router.post('/', handleSingleUpload('file'), uploadVaultDocument);
router.get('/:id/url', getVaultDocumentUrl);
router.delete('/:id', deleteVaultDocument);

export default router;
