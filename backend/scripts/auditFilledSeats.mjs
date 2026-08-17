/* Audit the Position Control Register for seats that read as Filled but have no
   selected candidate behind them — the duplicate rows HR sees under Register →
   status Filled.

   How they got there: PATCH /applications/:id/stage with stage=Selected used to
   run its seat claim again even when the application was ALREADY Selected (a
   double-click on Select, or re-saving the offer). The second claim took a fresh
   seat and repointed application.position_id at it, leaving the first seat Filled
   with the occupant's name and nothing referencing it, so the release path could
   never free it. The route now short-circuits that case, but seats already
   stranded in the database stay stranded until they are handed back.

   REPORT ONLY by default — nothing is written, nothing is ever deleted. Pass
   --fix to hand the orphaned seats back:
     status → Under Recruitment, occupant_name → '', vacant_since → now
   --fix writes a JSON snapshot of every affected seat's prior state next to this
   script first, so the change can be reversed field by field. Applications,
   candidates and uploaded documents are never read from or written to.

   Usage:  node scripts/auditFilledSeats.mjs [--fix]
   Needs MONGODB_URI in backend/.env (the same database the server uses). */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Position from '../src/models/Position.js';
import Application from '../src/models/Application.js';

const fix = process.argv.slice(2).includes('--fix');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — put it in backend/.env (the same database the server uses).');
  process.exit(1);
}
await mongoose.connect(uri);
console.log(`Connected to ${mongoose.connection.name}.\n`);

const filled = await Position.find({ status: 'Filled' }).sort('pcn');
const selected = await Application.find({ stage: 'Selected' }, 'candidate_name position_id pcn');
const claimed = new Map();
for (const a of selected) if (a.position_id) claimed.set(String(a.position_id), a);

const orphans = filled.filter((p) => !claimed.has(String(p._id)));

// Same person's name on more than one Filled seat — the visible symptom.
const byOccupant = new Map();
for (const p of filled) {
  const k = String(p.occupant_name || '').trim().toLowerCase();
  if (!k) continue;
  if (!byOccupant.has(k)) byOccupant.set(k, []);
  byOccupant.get(k).push(p);
}
const doubled = [...byOccupant.values()].filter((rows) => rows.length > 1);

console.log(`Filled seats: ${filled.length}   ·   backed by a Selected application: ${filled.length - orphans.length}\n`);

if (doubled.length) {
  console.log('Occupants holding more than one seat:');
  for (const rows of doubled) {
    console.log(`  ${rows[0].occupant_name}`);
    for (const p of rows) {
      const live = claimed.has(String(p._id));
      console.log(`    ${p.pcn.padEnd(16)} ${p.designation.padEnd(28)} ${live ? 'live selection' : 'ORPHAN'}`);
    }
  }
  console.log('');
}

if (!orphans.length) {
  console.log('No orphaned seats — every Filled seat has a Selected application behind it.');
} else {
  console.log(`Orphaned Filled seats (${orphans.length}) — occupant recorded, no application pointing here:`);
  for (const p of orphans) {
    console.log(`  ${p.pcn.padEnd(16)} ${p.designation.padEnd(28)} ${p.department.padEnd(18)} occupant: ${p.occupant_name || '(blank)'}`);
  }
  if (!fix) {
    console.log('\nReport only — nothing was changed. Re-run with --fix to hand these seats back');
    console.log('(status → Under Recruitment, occupant cleared). No application or document is touched.');
  } else {
    // Snapshot the prior state before writing, so this is reversible.
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      `filled-seats-backup-${stamp}.json`
    );
    fs.writeFileSync(backup, JSON.stringify(
      orphans.map((p) => ({
        _id: String(p._id),
        pcn: p.pcn,
        status: p.status,
        occupant_name: p.occupant_name,
        vacant_since: p.vacant_since,
      })),
      null, 2
    ));
    console.log(`\nPrior state saved to ${backup}`);

    const ids = orphans.map((p) => p._id);
    const r = await Position.updateMany(
      { _id: { $in: ids } },
      { status: 'Under Recruitment', occupant_name: '', vacant_since: new Date() }
    );
    console.log(`Handed back ${r.modifiedCount} seat(s) → Under Recruitment, occupant cleared.`);
  }
}

await mongoose.disconnect();
