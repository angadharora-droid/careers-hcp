import mongoose from 'mongoose';

// Candidate document bytes live in MongoDB, not on local disk: hosting
// filesystems are wiped on redeploy/restart, which used to orphan application
// records whose files then 404'd. Files are capped at 5 MB by multer, well
// under BSON's 16 MB document limit.
const candidateDocumentSchema = new mongoose.Schema(
  {
    // Key referenced by application.documents[].filename and /api/files/:filename
    filename: { type: String, required: true, unique: true },
    original_name: { type: String, default: '' },
    content_type: { type: String, default: 'application/pdf' },
    size: { type: Number, default: 0 },
    data: { type: Buffer, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export default mongoose.model('CandidateDocument', candidateDocumentSchema);
