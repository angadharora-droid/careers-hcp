/* Untangle a seat that two Selected applications both point at, by moving ONE of
   them onto another open seat of the same role.

   How it happens: a Filled seat was edited back to Under Recruitment through the
   register's Edit dialog while its selection still pointed at it. The occupant
   name was cleared, the seat looked open, and the next selection claimed it — so
   two candidates now hold one PCN, and the register names only the later one.
   PATCH /positions/:id now refuses that edit, but seats already double-booked
   stay that way until one application is moved.

   The named application moves; the other holder keeps the seat and gets its name
   back on it. The target is the given PCN, or else the lowest-numbered Vacant /
   Under Recruitment seat of the same job_code + designation that no selection
   holds — the seat the claim would have picked in the first place. Time-to-fill
   stamps follow the route's rules: the target is stamped as a fresh fill, and the
   old seat's stamps are cleared only if they were written by the claim that is
   now moving away.

   REPORT ONLY by default — nothing is written. Pass --fix to apply. --fix writes
   a JSON snapshot of both seats and the application first, so it can be reversed
   field by field. Nothing is ever deleted.

   Usage:  node scripts/moveDoubleBookedSelection.mjs <reference_id> [target PCN] [--fix]
   e.g.    node scripts/moveDoubleBookedSelection.mjs CPH-EFYAHX --fix
   Needs MONGODB_URI in backend/.env (the same database the server uses). */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Position from '../src/models/Position.js';
import Application from '../src/models/Application.js';
import ApplicationEvent from '../src/models/ApplicationEvent.js';
import { RECRUITABLE_STATUSES, daysToFill } from '../src/utils/helpers.js';

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const [refId, targetPcn] = args.filter((a) => !a.startsWith('--'));
if (!refId) {
  console.error('Usage: node scripts/moveDoubleBookedSelection.mjs <reference_id> [target PCN] [--fix]');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — put it in backend/.env (the same database the server uses).');
  process.exit(1);
}
await mongoose.connect(uri);
console.log(`Connected to ${mongoose.connection.name}.\n`);

function stop(msg) {
  console.error(msg);
  return mongoose.disconnect().then(() => process.exit(1));
}

const app = await Application.findOne({ reference_id: refId });
if (!app) await stop(`No application ${refId}.`);
if (app.stage !== 'Selected' || !app.position_id) {
  await stop(`${refId} (${app.candidate_name}) is ${app.stage}, not holding a seat — nothing to move.`);
}

const from = await Position.findById(app.position_id);
if (!from) await stop(`${refId} points at a seat that no longer exists (${app.position_id}).`);
const others = await Application.find(
  { stage: 'Selected', position_id: from._id, _id: { $ne: app._id } },
  'candidate_name reference_id'
);
if (!others.length) {
  await stop(`${from.pcn} is held by ${app.candidate_name} alone — it is not double-booked. ` +
    'Use the normal stage flow to change seats.');
}

const held = await Application.distinct('position_id', { stage: 'Selected', position_id: { $ne: null } });
const targetFilter = {
  job_code: app.job_code, designation: app.designation,
  status: { $in: RECRUITABLE_STATUSES }, _id: { $nin: held },
};
if (targetPcn) targetFilter.pcn = targetPcn;
const to = await Position.findOne(targetFilter).sort({ pcn: 1 });
if (!to) {
  await stop(targetPcn
    ? `${targetPcn} is not an open ${app.designation} seat (${app.job_code}) — it must be Vacant or Under Recruitment and held by no selection.`
    : `No open ${app.designation} seat (${app.job_code}) to move to — every seat is Filled or held. ` +
      'Open one in the register first, or move the other holder out of Selected instead.');
}

// The claim writes occupant_name and the fill stamps together, so whoever's name
// is on the seat is whoever's claim the stamps describe.
const moverOnSeat = String(from.occupant_name || '').trim().toLowerCase()
  === String(app.candidate_name || '').trim().toLowerCase();
const stays = others[0];

console.log(`${from.pcn} (${from.designation}) is held by ${others.length + 1} Selected applications:`);
console.log(`  ${app.reference_id}  ${app.candidate_name}   ← moves`);
for (const o of others) console.log(`  ${o.reference_id}  ${o.candidate_name}   ← stays`);
console.log(`\nPlan:`);
console.log(`  ${app.reference_id} ${app.candidate_name}: ${from.pcn} → ${to.pcn}`);
console.log(`  ${to.pcn}: ${to.status} → Filled, occupant "${app.candidate_name}"`);
console.log(`  ${from.pcn}: stays Filled, occupant "${from.occupant_name}" → "${moverOnSeat ? stays.candidate_name : from.occupant_name}"` +
  (moverOnSeat ? ', fill stamps cleared (they described the moving claim)' : ''));
if (others.length > 1) {
  console.log(`\n  NOTE: ${others.length} applications remain on ${from.pcn} after this — run again for the next one.`);
}

if (!fix) {
  console.log('\nReport only — nothing was changed. Re-run with --fix to apply.');
  await mongoose.disconnect();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  `seat-move-backup-${stamp}.json`
);
const seatState = (p) => ({
  _id: String(p._id), pcn: p.pcn, status: p.status, occupant_name: p.occupant_name,
  vacant_since: p.vacant_since, filled_on: p.filled_on, days_to_fill: p.days_to_fill,
});
fs.writeFileSync(backup, JSON.stringify({
  application: { _id: String(app._id), reference_id: app.reference_id, position_id: String(app.position_id), pcn: app.pcn },
  from: seatState(from),
  to: seatState(to),
}, null, 2));
console.log(`\nPrior state saved to ${backup}`);

// Same atomic compare-and-set as the selection claim, so nothing can race it.
const filledOn = new Date();
const claimed = await Position.findOneAndUpdate(
  { _id: to._id, status: { $in: RECRUITABLE_STATUSES } },
  {
    status: 'Filled', occupant_name: app.candidate_name, vacant_since: null,
    filled_on: filledOn, days_to_fill: daysToFill(to.vacant_since, filledOn),
  },
  { new: true }
);
if (!claimed) await stop(`${to.pcn} was taken while this ran — nothing was changed.`);

app.position_id = to._id;
app.pcn = to.pcn;
await app.save();

if (moverOnSeat) {
  await Position.findByIdAndUpdate(from._id, {
    occupant_name: stays.candidate_name, filled_on: null, days_to_fill: null,
  });
}

await ApplicationEvent.create({
  application_id: app._id,
  type: 'edit',
  summary: `Seat moved to ${to.pcn}`,
  detail: `${from.pcn} was double-booked with ${others.map((o) => `${o.candidate_name} (${o.reference_id})`).join(', ')}, who keeps it`,
  from: from.pcn,
  to: to.pcn,
  actor_name: 'Register repair',
});

console.log(`Moved ${app.candidate_name} to ${to.pcn}. ${from.pcn} now names ${moverOnSeat ? stays.candidate_name : from.occupant_name}.`);
await mongoose.disconnect();
