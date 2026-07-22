import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import PanelRule from '../models/PanelRule.js';
import { roundsForGrade } from '../utils/helpers.js';
import { CPA_PANEL_SHEET, NAME_ALIASES } from './cpaPanelSheet.js';

/* Turns a unit's own panel sheet into PanelRule documents.

   Names are resolved against the LIVE user directory, not against panelData.js, so an
   account HR created through the Interviewers page counts just as much as a seeded one.
   Anything that cannot be resolved is reported by name and left out — a wrong guess
   would route a candidate to the wrong interviewer, which is worse than a gap.

     npm run import-panel -- --dry    show what would change, write nothing
     npm run import-panel             apply                                        */

const norm = (s) => String(s).toLowerCase()
  .replace(/\b(sir|madam)\b/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

export async function importPanelSheet({ dry = false, log = console.log } = {}) {
  const tag = dry ? '[dry] ' : '';
  const users = await User.find({ roles: 'interviewer' }).select('name email');
  const byName = new Map();
  for (const u of users) {
    const k = norm(u.name);
    // A duplicated name is ambiguous — record it so we refuse to pick one at random.
    byName.set(k, byName.has(k) ? null : u);
  }

  const resolve = (sheetName) => {
    const target = NAME_ALIASES[sheetName] || sheetName;
    const hit = byName.get(norm(target));
    if (hit === null) return { error: `"${sheetName}" is ambiguous — more than one account is named "${target}"` };
    if (!hit) return { error: `"${sheetName}"${NAME_ALIASES[sheetName] ? ` (looked for "${target}")` : ''} has no interviewer account` };
    return { user: hit };
  };

  const unresolved = new Map(); // sheet name -> reason
  const byKey = new Map();      // unit|grade|dept -> { rounds, jobs }

  for (const row of CPA_PANEL_SHEET) {
    // The sheet lists three panels on every row, but a grade only runs as many as its
    // Grade.panel_size — importing a Panel 3 for a B2 would create an assignment for a
    // panel that never happens.
    const maxPanels = await roundsForGrade(row.grade);
    const rounds = [];
    for (let i = 0; i < Math.min(row.panels.length, maxPanels); i++) {
      const resolved = [];
      for (const name of row.panels[i]) {
        const r = resolve(name);
        if (r.error) { if (!unresolved.has(name)) unresolved.set(name, r.error); continue; }
        if (!resolved.some((u) => String(u._id) === String(r.user._id))) resolved.push(r.user);
      }
      if (resolved.length) {
        rounds.push({ round: i + 1, interviewer_user_id: resolved[0]._id, alternates: resolved.slice(1).map((u) => u._id) });
      }
    }
    if (!rounds.length) continue;

    // PanelRule is keyed by unit+grade+department, the sheet by job code. Two job
    // codes can therefore collide (CPA-FO-C1 and CPA-VAL-C1 share Front Office / C1).
    const key = `CPA|${row.grade}|${row.department}`;
    const sig = JSON.stringify(rounds.map((r) => [r.round, String(r.interviewer_user_id), r.alternates.map(String)]));
    const prev = byKey.get(key);
    if (prev && prev.sig !== sig) {
      log(`${tag}CONFLICT  ${prev.jobs.join(', ')} and ${row.job_code} share ${key} but list different panels — kept the first.`);
      prev.jobs.push(row.job_code);
      continue;
    }
    if (prev) { prev.jobs.push(row.job_code); continue; }
    byKey.set(key, { rounds, sig, jobs: [row.job_code], grade: row.grade, department: row.department });
  }

  let written = 0;
  for (const [, v] of byKey) {
    if (!dry) {
      await PanelRule.findOneAndUpdate(
        { unit_code: 'CPA', grade: v.grade, department: v.department },
        { unit_code: 'CPA', grade: v.grade, department: v.department, rounds: v.rounds, source: 'import' },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
    written += 1;
    log(`${tag}  ${String(v.grade).padEnd(3)} ${v.department.padEnd(20)} ` +
      v.rounds.map((r) => `P${r.round}:${1 + r.alternates.length}`).join(' ') +
      `   (${v.jobs.join(', ')})`);
  }

  log(`${tag}${written} panel rule(s) from ${CPA_PANEL_SHEET.length} sheet rows.`);
  if (unresolved.size) {
    log(`${tag}${unresolved.size} name(s) could not be resolved and were left out:`);
    for (const [, reason] of unresolved) log(`${tag}  ${reason}`);
    log(`${tag}Create these accounts in the Interviewers page, then re-run — the import is idempotent.`);
  } else {
    log(`${tag}Every name on the sheet resolved to an account.`);
  }
  return { written, unresolved: [...unresolved.keys()] };
}

// Standalone: node src/seed/importPanel.js [--dry]
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('seed/importPanel.js')) {
  const { connectDB } = await import('../db.js');
  await connectDB();
  await importPanelSheet({ dry: process.argv.includes('--dry') });
  await mongoose.disconnect();
}
