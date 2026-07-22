import 'dotenv/config';
import mongoose from 'mongoose';
import Competency from '../models/Competency.js';
import Position from '../models/Position.js';
import Application from '../models/Application.js';
import PanelScore from '../models/PanelScore.js';
import { COMPETENCIES, ROSTER } from './seedData.js';
import { resolveCompetencies } from '../utils/helpers.js';

/* Brings an ALREADY-POPULATED database up to the current assessment library.

   seedIfEmpty() stops the moment a single position exists, so a deployed unit never
   picks up competency changes on restart — and it deliberately should not, because HR
   edits anchors through the Framework page and an automatic refresh on every boot
   would silently overwrite that work. (The panel matrix is the exception: it is
   rebuilt each boot because the workbook, not the UI, owns it.)

   So this is an explicit, idempotent command:
     npm run sync            apply
     npm run sync -- --dry   print the plan, write nothing

   It upserts the library, drops competencies that the library no longer defines
   (an orphan left behind — e.g. the old 'foknow' — would push a scoring form past
   100%), and back-fills competency_profile on seats and on un-scored applications. */

const keyOf = (c) => `${c.profile}::${c.key}`;

export async function syncAssessmentLibrary({ dry = false, log = console.log } = {}) {
  const tag = dry ? '[dry] ' : '';
  const report = { upserted: 0, unchanged: 0, removed: [], seats: 0, apps: 0, unmatched: [], problems: [] };

  /* ---- 1. competency library ---- */
  const managedProfiles = [...new Set(COMPETENCIES.map((c) => c.profile))];
  const wanted = new Map(COMPETENCIES.map((c) => [keyOf(c), c]));

  for (const c of COMPETENCIES) {
    const existing = await Competency.findOne({ profile: c.profile, key: c.key });
    const same =
      existing &&
      existing.name === c.name &&
      existing.section === c.section &&
      existing.weight === c.weight &&
      existing.order === c.order &&
      !!existing.is_placeholder === !!c.is_placeholder &&
      existing.anchors.length === c.anchors.length &&
      existing.anchors.every((a, i) => a === c.anchors[i]);
    if (same) { report.unchanged += 1; continue; }
    report.upserted += 1;
    if (!dry) {
      await Competency.findOneAndUpdate(
        { profile: c.profile, key: c.key },
        {
          name: c.name, section: c.section, weight: c.weight, order: c.order,
          anchors: c.anchors, is_placeholder: !!c.is_placeholder,
        },
        { upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
    }
  }

  // Anything left in a managed profile that the library no longer defines. Scoped to
  // managed profiles only, so a profile HR invented by hand is never touched.
  const stale = (await Competency.find({ profile: { $in: managedProfiles } }))
    .filter((c) => !wanted.has(keyOf(c)));
  for (const c of stale) {
    report.removed.push(`${c.profile}/${c.key} (${c.weight}% — ${c.name})`);
    if (!dry) await Competency.deleteOne({ _id: c._id });
  }

  /* ---- 2. back-fill competency_profile on seats ---- */
  const profByDesignation = new Map(ROSTER.map((r) => [r.desig, r.prof]));
  for (const [desig, prof] of profByDesignation) {
    const filter = { designation: desig, competency_profile: { $ne: prof } };
    const n = await Position.countDocuments(filter);
    if (!n) continue;
    report.seats += n;
    if (!dry) await Position.updateMany(filter, { $set: { competency_profile: prof } });
  }

  // Seats HR created by hand that the roster says nothing about — reported, not guessed at.
  const orphanSeats = await Position.find({
    designation: { $nin: [...profByDesignation.keys()] },
  }).select('pcn designation department grade competency_profile');
  for (const s of orphanSeats) {
    if (!s.competency_profile) report.unmatched.push(`${s.pcn} — ${s.designation} (${s.department}, ${s.grade})`);
  }

  /* ---- 3. back-fill applications that have not been scored yet ---- */
  // An application already carrying a score keeps its original profile: changing the
  // form mid-flight would have round 2 grading against different competencies to round 1.
  const scoredIds = new Set((await PanelScore.distinct('application_id')).map(String));
  const openApps = await Application.find({ stage: { $nin: ['Rejected'] } }).select('designation competency_profile');
  for (const a of openApps) {
    if (scoredIds.has(String(a._id))) continue;
    const prof = profByDesignation.get(a.designation);
    if (!prof || a.competency_profile === prof) continue;
    report.apps += 1;
    if (!dry) await Application.updateOne({ _id: a._id }, { $set: { competency_profile: prof } });
  }

  /* ---- 4. verify every profile actually in use builds a 100% form ---- */
  if (!dry) {
    const inUse = [...new Set((await Position.distinct('competency_profile')).filter(Boolean))];
    for (const p of inUse) {
      const comps = await resolveCompetencies(p);
      const total = comps.reduce((s, c) => s + c.weight, 0);
      if (total !== 100) report.problems.push(`${p} totals ${total}%, not 100%`);
      const ph = comps.filter((c) => c.is_placeholder).length;
      if (ph) report.problems.push(`${p} still resolves ${ph} placeholder competenc${ph === 1 ? 'y' : 'ies'}`);
    }
  }

  /* ---- report ---- */
  log(`${tag}Competencies: ${report.upserted} written, ${report.unchanged} already current, ${report.removed.length} removed.`);
  for (const r of report.removed) log(`${tag}  removed  ${r}`);
  log(`${tag}Seats re-profiled: ${report.seats}.  Un-scored applications re-profiled: ${report.apps}.`);
  if (report.unmatched.length) {
    log(`${tag}${report.unmatched.length} seat(s) not in the roster and still on the generic placeholders — set a profile by hand in the HR panel:`);
    for (const u of report.unmatched) log(`${tag}  ${u}`);
  }
  if (report.problems.length) {
    log(`${tag}PROBLEMS:`);
    for (const p of report.problems) log(`${tag}  ${p}`);
  } else if (!dry) {
    log('Every profile in use builds a complete 100% scoring form with no placeholders.');
  }
  return report;
}

// Standalone: node src/seed/sync.js [--dry]
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed/sync.js')) {
  const { connectDB } = await import('../db.js');
  await connectDB();
  const r = await syncAssessmentLibrary({ dry: process.argv.includes('--dry') });
  await mongoose.disconnect();
  process.exit(r.problems.length ? 1 : 0);
}
