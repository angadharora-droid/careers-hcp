import multer from 'multer';
import CandidateDocument from '../models/CandidateDocument.js';

// Shared multipart config for candidate documents: PDF only, ≤5 MB each, ≤6 per
// request. memoryStorage — the bytes are persisted to MongoDB (CandidateDocument),
// never to local disk, so documents survive redeploys the same way applications do.
export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.pdf$/i.test(file.originalname);
    cb(ok ? null : new Error('Only PDF files are allowed'), ok);
  },
});

const storedFilename = (originalname) => {
  const safe = originalname.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`;
};

// Persists uploaded files and returns the [{ filename, original_name }] entries
// stored on the application.
export async function saveCandidateDocuments(files) {
  const docs = [];
  for (const f of files || []) {
    const doc = await CandidateDocument.create({
      filename: storedFilename(f.originalname),
      original_name: f.originalname,
      content_type: f.mimetype || 'application/pdf',
      size: f.size,
      data: f.buffer,
    });
    docs.push({ filename: doc.filename, original_name: f.originalname });
  }
  return docs;
}

export async function deleteCandidateDocuments(entries) {
  const filenames = (entries || []).map((d) => d.filename).filter(Boolean);
  if (filenames.length) await CandidateDocument.deleteMany({ filename: { $in: filenames } });
}
