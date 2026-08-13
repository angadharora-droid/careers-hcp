/* Rescue: pull candidate documents that the LIVE server can still serve and
   store their bytes permanently in MongoDB (CandidateDocument).

   Railway (and similar hosts) rebuild the container disk on every deploy, so
   files in uploads/ survive only until the next deploy. Run this from ANY
   machine BEFORE deploying new code: it logs into the live API as HR, walks
   every application's document list, downloads each file the server still has,
   and writes the bytes into the database. Whatever it can't download any more
   is reported per candidate so HR can request a re-send.

   Needs three values (env vars, or backend/.env):
     API          e.g. https://careers-hcp.centrepointgroup.in/api
     HR_EMAIL     an hr_admin login
     HR_PASSWORD  its password
     MONGODB_URI  the SAME database the live server uses
                  (Railway dashboard → backend service → Variables → MONGODB_URI)

   Usage:  node scripts/rescueUploadsFromServer.mjs [--dry]
   Idempotent — documents already in the database are skipped. */
import 'dotenv/config';
import mongoose from 'mongoose';
import CandidateDocument from '../src/models/CandidateDocument.js';

const API = (process.env.API || '').replace(/\/$/, '');
const { HR_EMAIL, HR_PASSWORD, MONGODB_URI } = process.env;
const dry = process.argv.includes('--dry');

for (const [name, val] of [['API', API], ['HR_EMAIL', HR_EMAIL], ['HR_PASSWORD', HR_PASSWORD], ['MONGODB_URI', MONGODB_URI]]) {
  if (!val) {
    console.error(`${name} is not set — see the header of this script.`);
    process.exit(1);
  }
}

const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: HR_EMAIL, password: HR_PASSWORD }),
});
if (!loginRes.ok) {
  console.error(`Login to ${API} failed (${loginRes.status}) — check HR_EMAIL / HR_PASSWORD.`);
  process.exit(1);
}
const { token } = await loginRes.json();
const auth = { Authorization: `Bearer ${token}` };

const appsRes = await fetch(`${API}/applications`, { headers: auth });
if (!appsRes.ok) {
  console.error(`Could not list applications (${appsRes.status}).`);
  process.exit(1);
}
const { applications } = await appsRes.json();

await mongoose.connect(MONGODB_URI);
console.log(`Live API: ${API}\nDatabase: ${mongoose.connection.name}\nApplications with documents: ${applications.filter((a) => a.documents?.length).length}\n`);

let inDb = 0;
let rescued = 0;
const missing = [];

for (const app of applications) {
  for (const doc of app.documents || []) {
    if (await CandidateDocument.exists({ filename: doc.filename })) {
      inDb += 1;
      continue;
    }
    const fileRes = await fetch(`${API}/files/${encodeURIComponent(doc.filename)}`, { headers: auth });
    if (fileRes.ok) {
      const data = Buffer.from(await fileRes.arrayBuffer());
      if (!dry) {
        await CandidateDocument.create({
          filename: doc.filename,
          original_name: doc.original_name || doc.filename,
          content_type: fileRes.headers.get('content-type')?.split(';')[0] || 'application/pdf',
          size: data.length,
          data,
        });
      }
      rescued += 1;
      console.log(`${dry ? 'would rescue' : 'rescued'}  ${doc.filename}  (${app.reference_id} — ${app.candidate_name})`);
    } else {
      missing.push(`${app.reference_id}  ${app.candidate_name}  <${app.email}>  ${doc.original_name || doc.filename}`);
    }
  }
}

console.log(`\n${dry ? '[dry run] ' : ''}${inDb} already in the database, ${rescued} rescued from the live server, ${missing.length} lost.`);
if (missing.length) {
  console.log('\nLOST — the server no longer has these; ask the candidates to resend, then attach via the HR panel:');
  for (const line of missing) console.log(`  ${line}`);
}
await mongoose.disconnect();
