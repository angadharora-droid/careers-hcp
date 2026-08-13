import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Position from '../models/Position.js';
import Application from '../models/Application.js';
import Grade from '../models/Grade.js';
import {
  RECRUITABLE_STATUSES, wordCount, makeReferenceId, roleSlugOf,
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
//
// Roles are grouped by DESIGNATION (the advertised position name), not by
// job_code: the PCN scheme is fixed as UNIT-DEPT-GRADE-SERIAL, so two different
// roles in the same department and grade legitimately share a job_code
// (Admin Executive and Purchase Executive both sit under CPA-ADM-B1).
async function openRolesGrouped() {
  const open = await Position.find({ status: { $in: RECRUITABLE_STATUSES } }).sort('pcn');
  const grades = await Grade.find({});
  const gradeLabel = Object.fromEntries(grades.map((g) => [g.code, g.meaning]));
  const byRole = {};
  const seniority = {}; // salary_max as seniority proxy — used only to order, never sent
  for (const p of open) {
    const slug = roleSlugOf(p.designation);
    if (!byRole[slug]) {
      byRole[slug] = {
        slug,                   // stable public key / URL segment for the role
        job_code: p.job_code,   // establishment code — informational, may be shared
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
      seniority[slug] = p.salary_max || 0;
    }
    byRole[slug].openings += 1;
  }
  return Object.values(byRole).sort((a, b) => seniority[b.slug] - seniority[a.slug]);
}

// GET /api/public/positions — open roles grouped by designation
router.get('/positions', async (_req, res) => {
  res.json({ roles: await openRolesGrouped() });
});

// GET /api/public/positions/:slug — job_code accepted as a legacy fallback
// (pre-slug links); with shared codes it resolves to the first matching role.
router.get('/positions/:slug', async (req, res) => {
  const roles = await openRolesGrouped();
  const role = roles.find((r) => r.slug === req.params.slug)
    || roles.find((r) => r.job_code === req.params.slug);
  if (!role) return res.status(404).json({ error: 'This role is not currently open' });
  res.json({ role });
});

// Every field on the public apply form is mandatory. Enforced here rather than
// with `required` on the schema, so that HR-side saves of applications taken
// before this rule (which have blanks) don't fail validation.
const REQUIRED_FIELDS = [
  'designation', 'candidate_name', 'mobile', 'email', 'age', 'gender', 'qualification',
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
    if (wordCount(b.intro_note) > 50) {
      return res.status(400).json({ error: 'Brief intro must be 50 words or fewer' });
    }
    // Role must actually be open. A role is its designation (position name) —
    // job_code can be shared by two roles in the same department + grade, so it
    // must never be used to select seats here.
    const desigRx = new RegExp(
      `^${String(b.designation).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'
    );
    const seat = await Position.findOne({ designation: desigRx, status: { $in: RECRUITABLE_STATUSES } }).sort('pcn');
    if (!seat) return res.status(400).json({ error: 'This role is not open for applications' });

    // Business rule: first application against a role flips its Vacant seats to
    // Under Recruitment (recruitment activity has started).
    await Position.updateMany({ designation: desigRx, status: 'Vacant' }, { status: 'Under Recruitment' });

    const app = await Application.create({
      reference_id: makeReferenceId(),
      job_code: seat.job_code,
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
