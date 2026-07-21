import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { connectDB } from './db.js';
import { seedIfEmpty } from './seed/seed.js';
import { requireAuth } from './middleware/auth.js';

import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import positionRoutes from './routes/positions.js';
import applicationRoutes from './routes/applications.js';
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
app.use('/api/users', userRoutes);             // HR
app.use('/api/grades', gradeRoutes);
app.use('/api/competencies', competencyRoutes);
app.use('/api/dashboard', dashboardRoutes);    // HR
app.use('/api/interviewer', interviewerRoutes); // interviewers, scoped by panel_assignments

// Uploaded candidate documents — any authenticated internal user (HR / interviewer)
app.use('/api/files', requireAuth, express.static(path.resolve('uploads')));

// JSON error handler (multer errors etc.)
app.use((err, _req, res, _next) => {
  res.status(err.status || 400).json({ error: err.message || 'Request failed' });
});

const PORT = process.env.PORT || 5000;
await connectDB();
await seedIfEmpty();
app.listen(PORT, () => console.log(`CPH backend listening on http://localhost:${PORT}`));
