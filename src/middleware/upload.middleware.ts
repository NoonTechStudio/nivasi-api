import multer from 'multer';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const storage = multer.memoryStorage();

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error('Only JPEG, PNG, HEIC or PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Wraps multer's single-file handler so validation/size errors come back as a
// clean 400 response instead of falling through to the generic 500 handler.
export function handleSingleUpload(field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    uploadDocument.single(field)(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        return res.status(400).json({ success: false, message });
      }
      next();
    });
  };
}
