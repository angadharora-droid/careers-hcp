/* Targeted hand-back for the duplicate rows HR sees under Register → Filled:
   orphaned Filled seats (no Selected application pointing at them) whose
   occupant NAME is recorded. Unlike auditFilledSeats --fix, this leaves
   blank-occupant Filled seats alone (e.g. GM / Ops Manager seats seeded as
   Filled for existing staff) — those are not double-claim damage.

   Writes a JSON snapshot of every affected seat's prior state next to this
   script before changing anything, so the change can be reversed field by
   field. Applications, candidates and uploaded documents are never touched.

   Usage:  node scripts/handBackDuplicateSeats.mjs
   Needs MONGODB_URI in backend/.env (the same database the server uses). */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Position from '../src/models/Position.js';
import Application from '../src/models/Application.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — put it in backend/.env (the same database the server uses).');
  process.exit(1);
}
await mongoose.connect(uri);
console.log(`Connected to ${mongoose.connection.name}.\n`);

const filled = await Position.find({ status: 'Filled' }).sort('pcn');
const selected = await Application.find({ stage: 'Selected' }, 'position_id');
const claimed = new Set(selected.filter((a) => a.position_id).map((a) => String(a.position_id)));

const targets = filled.filter(
  (p) => !claimed.has(String(p._id)) && String(p.occupant_name || '').trim() !== ''
);

if (!targets.length) {
  console.log('Nothing to hand back — no orphaned Filled seat has an occupant name recorded.');
} else {
  console.log(`Handing back ${targets.length} seat(s):`);
  for (const p of targets) {
    console.log(`  ${p.pcn.padEnd(16)} ${p.designation.padEnd(28)} occupant: ${p.occupant_name}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    `filled-seats-backup-${stamp}.json`
  );
  fs.writeFileSync(backup, JSON.stringify(
    targets.map((p) => ({
      _id: String(p._id),
      pcn: p.pcn,
      status: p.status,
      occupant_name: p.occupant_name,
      vacant_since: p.vacant_since,
    })),
    null, 2
  ));
  console.log(`\nPrior state saved to ${backup}`);

  const r = await Position.updateMany(
    { _id: { $in: targets.map((p) => p._id) } },
    { status: 'Under Recruitment', occupant_name: '', vacant_since: new Date() }
  );
  console.log(`Handed back ${r.modifiedCount} seat(s) → Under Recruitment, occupant cleared.`);
}

await mongoose.disconnect();
