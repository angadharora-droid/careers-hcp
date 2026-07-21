import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Position from '../models/Position.js';
import Application from '../models/Application.js';
import Grade from '../models/Grade.js';
import {
  RECRUITABLE_STATUSES, wordCount, makeReferenceId,
} from '../utils/helpers.js';

const router = Router();

const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.pdf$/i.test(file.originalname);
    cb(ok ? null : new Error('Only PDF files are allowed'), ok);
  },
});

// Public projection: NEVER expose PCN seat codes, salary bands, budgeted
// salary, occupants, scores, interviewer identities, or other applicants' data.
// Salary is discussed at interview stage, never advertised.
async function openRolesGrouped() {
  const open = await Position.find({ status: { $in: RECRUITABLE_STATUSES } }).sort('pcn');
  const grades = await Grade.find({});
  const gradeLabel = Object.fromEntries(grades.map((g) => [g.code, g.meaning]));
  const byCode = {};
  const seniority = {}; // salary_max as seniority proxy — used only to order, never sent
  for (const p of open) {
    if (!byCode[p.job_code]) {
      byCode[p.job_code] = {
        job_code: p.job_code,
        designation: p.designation,
        department: p.department,
        job_family: p.job_family,
        grade_label: gradeLabel[p.grade] || p.grade, // plain language, not internal code
        unit: p.unit,
        location: 'Amravati, Maharashtra',
        reports_to: p.reports_to,
        job_description: p.job_description,
        openings: 0,
      };
      seniority[p.job_code] = p.salary_max || 0;
    }
    byCode[p.job_code].openings += 1;
  }
  return Object.values(byCode).sort((a, b) => seniority[b.job_code] - seniority[a.job_code]);
}

// GET /api/public/positions — open roles grouped by job_code
router.get('/positions', async (_req, res) => {
  res.json({ roles: await openRolesGrouped() });
});

// GET /api/public/positions/:job_code
router.get('/positions/:job_code', async (req, res) => {
  const roles = await openRolesGrouped();
  const role = roles.find((r) => r.job_code === req.params.job_code);
  if (!role) return res.status(404).json({ error: 'This role is not currently open' });
  res.json({ role });
});

// Every field on the public apply form is mandatory. Enforced here rather than
// with `required` on the schema, so that HR-side saves of applications taken
// before this rule (which have blanks) don't fail validation.
const REQUIRED_FIELDS = [
  'job_code', 'candidate_name', 'mobile', 'email', 'age', 'gender', 'qualification',
  'total_experience_years', 'expected_salary', 'willing_to_relocate', 'needs_accommodation',
  'worked_at_cph_before', 'source', 'why_join', 'intro_note',
];
const CURRENT_EMPLOYMENT_FIELDS = ['current_designation', 'years_in_current_firm', 'current_salary'];

// POST /api/public/applications — multipart/form-data, files under "documents"
router.post('/applications', upload.array('documents', 6), async (req, res) => {
  try {
    const b = req.body || {};
    const missing = (f) => !String(b[f] ?? '').trim();
    for (const f of REQUIRED_FIELDS) {
      if (missing(f)) return res.status(400).json({ error: `${f.replace(/_/g, ' ')} is required` });
    }
    // A candidate declaring 0 years of experience has no current employer to describe.
    if (Number(b.total_experience_years) !== 0) {
      for (const f of CURRENT_EMPLOYMENT_FIELDS) {
        if (missing(f)) return res.status(400).json({ error: `${f.replace(/_/g, ' ')} is required` });
      }
    }
    if (!(req.files || []).length) {
      return res.status(400).json({ error: 'At least one document is required' });
    }
    if (wordCount(b.intro_note) > 50) {
      return res.status(400).json({ error: 'Brief intro must be 50 words or fewer' });
    }
    // Role must actually be open
    const seat = await Position.findOne({ job_code: b.job_code, status: { $in: RECRUITABLE_STATUSES } });
    if (!seat) return res.status(400).json({ error: 'This role is not open for applications' });

    // Business rule: first application against a role flips its Vacant seats to
    // Under Recruitment (recruitment activity has started).
    await Position.updateMany({ job_code: b.job_code, status: 'Vacant' }, { status: 'Under Recruitment' });

    const app = await Application.create({
      reference_id: makeReferenceId(),
      job_code: b.job_code,
      designation: seat.designation,
      department: seat.department,
      grade: seat.grade,
      job_family: seat.job_family,
      competency_profile: seat.competency_profile,
      unit: seat.unit,
      candidate_name: b.candidate_name.trim(),
      age: b.age ? Number(b.age) : undefined,
      gender: b.gender,
      mobile: b.mobile.trim(),
      email: b.email.trim(),
      qualification: b.qualification,
      total_experience_years: b.total_experience_years ? Number(b.total_experience_years) : undefined,
      current_designation: b.current_designation,
      years_in_current_firm: b.years_in_current_firm ? Number(b.years_in_current_firm) : undefined,
      current_salary: b.current_salary ? Number(b.current_salary) : undefined,
      expected_salary: b.expected_salary ? Number(b.expected_salary) : undefined,
      willing_to_relocate: b.willing_to_relocate,
      needs_accommodation: b.needs_accommodation,
      worked_at_cph_before: b.worked_at_cph_before,
      source: b.source,
      why_join: b.why_join,
      intro_note: b.intro_note,
      documents: (req.files || []).map((f) => ({ filename: f.filename, original_name: f.originalname })),
    });
    res.status(201).json({
      reference_id: app.reference_id,
      message: 'Application received. Save your reference ID for any correspondence with HR.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
