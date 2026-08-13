/* One-time migration: sweep uploaded candidate documents from the local uploads/
   folder into MongoDB (CandidateDocument), so files uploaded before database
   storage stop being one redeploy away from loss.

   Run this ON THE SERVER that hosts (or hosted) the uploads/ folder — the bytes
   can only be imported from a disk that still has them. For every document listed
   on an application it reports one of:
     in db     — bytes already in MongoDB, nothing to do
     imported  — found on disk, copied into MongoDB
     MISSING   — bytes exist nowhere; ask the candidate to resend the file, then
                 attach it in the HR panel (Documents → Attach PDF)

   Usage:  node scripts/migrateUploadsToDb.mjs [--dir <uploads-path>] [--dry]
   Looks in --dir (if given), ./uploads relative to the working directory, and
   backend/uploads. Needs MONGODB_URI in backend/.env. */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Application from '../src/models/Application.js';
import CandidateDocument from '../src/models/CandidateDocument.js';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const dirArg = args.indexOf('--dir');

const candidates = [];
if (dirArg !== -1 && args[dirArg + 1]) candidates.push(path.resolve(args[dirArg + 1]));
candidates.push(
  path.resolve('uploads'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads'),
);
const dirs = [...new Set(candidates)].filter((d) => fs.existsSync(d));

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — put it in backend/.env (the same database the server uses).');
  process.exit(1);
}
await mongoose.connect(uri);
console.log(`Connected to ${mongoose.connection.name}. Searching folders:\n  ${dirs.join('\n  ') || '(none found on this machine)'}\n`);

const findOnDisk = (filename) => {
  for (const dir of dirs) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }
  return null;
};

let inDb = 0;
let imported = 0;
const missing = [];

const apps = await Application.find({ 'documents.0': { $exists: true } }).sort('created_at');
for (const app of apps) {
  for (const doc of app.documents) {
    if (await CandidateDocument.exists({ filename: doc.filename })) {
      inDb += 1;
      continue;
    }
    const full = findOnDisk(doc.filename);
    if (full) {
      if (!dry) {
        const data = fs.readFileSync(full);
        await CandidateDocument.create({
          filename: doc.filename,
          original_name: doc.original_name || doc.filename,
          content_type: 'application/pdf',
          size: data.length,
          data,
        });
      }
      imported += 1;
      console.log(`${dry ? 'would import' : 'imported'}  ${doc.filename}  (${app.reference_id} — ${app.candidate_name})`);
    } else {
      missing.push(`${app.reference_id}  ${app.candidate_name}  <${app.email}>  ${doc.original_name || doc.filename}`);
    }
  }
}

console.log(`\n${dry ? '[dry run] ' : ''}${inDb} already in the database, ${imported} imported from disk, ${missing.length} missing.`);
if (missing.length) {
  console.log('\nMISSING — bytes exist nowhere; ask these candidates to resend, then attach via the HR panel:');
  for (const line of missing) console.log(`  ${line}`);
}
await mongoose.disconnect();
