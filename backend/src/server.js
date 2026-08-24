import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';
import { seedIfEmpty } from './seed/seed.js';
import { requireAuth } from './middleware/auth.js';
import CandidateDocument from './models/CandidateDocument.js';

import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import positionRoutes from './routes/positions.js';
import applicationRoutes from './routes/applications.js';
import registerRoutes from './routes/register.js';
import userRoutes from './routes/users.js';
import gradeRoutes from './routes/grades.js';
import competencyRoutes from './routes/competencies.js';
import dashboardRoutes from './routes/dashboard.js';
import interviewerRoutes from './routes/interviewer.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cph-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);          // Career Panel — no auth
app.use('/api/positions', positionRoutes);     // HR
app.use('/api/applications', applicationRoutes); // HR (+ shared scores read)
app.use('/api/register', registerRoutes);      // HR — Application Register (compiled view)
app.use('/api/users', userRoutes);             // HR
app.use('/api/grades', gradeRoutes);
app.use('/api/competencies', competencyRoutes);
app.use('/api/dashboard', dashboardRoutes);    // HR
app.use('/api/interviewer', interviewerRoutes); // interviewers, scoped by panel_assignments

// Uploaded candidate documents — any authenticated internal user (HR / interviewer).
// Bytes live in MongoDB (CandidateDocument) so they survive redeploys/restarts;
// the disk lookup only covers legacy files uploaded before that, which existed
// on local disk and disappeared whenever the host's filesystem was reset.
const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
app.get('/api/files/:filename', requireAuth, async (req, res) => {
  const { filename } = req.params;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const doc = await CandidateDocument.findOne({ filename });
  if (doc) {
    res.set('Content-Type', doc.content_type || 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${(doc.original_name || filename).replace(/"/g, '')}"`);
    return res.send(doc.data);
  }
  // Legacy fallback: uploads/ relative to the process cwd (historical behaviour)
  // and relative to the backend package root (in case the service cwd changed).
  for (const dir of [path.resolve('uploads'), path.join(BACKEND_ROOT, 'uploads')]) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return res.sendFile(full);
  }
  res.status(404).json({
    error: 'This document is no longer on the server. It was uploaded before documents were stored in the database and was lost when the server was redeployed. Please ask the candidate to resend it, then attach it to their application.',
  });
});

// JSON error handler (multer errors etc.)
app.use((err, _req, res, _next) => {
  res.status(err.status || 400).json({ error: err.message || 'Request failed' });
});

const PORT = process.env.PORT || 5000;
await connectDB();
await seedIfEmpty();
app.listen(PORT, () => console.log(`CPH backend listening on http://localhost:${PORT}`));
