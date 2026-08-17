/* Full database backup — every collection, including the candidate CV bytes.

   Writes backups/<timestamp>/<collection>.ndjson, one document per line in
   Extended JSON. EJSON is used rather than plain JSON.stringify because it keeps
   ObjectIds, Dates and — the reason this script exists — the Buffer holding each
   uploaded PDF, so documents restore byte-for-byte instead of arriving as a
   useless `{"0":37,"1":80,...}` object.

   NDJSON (a document per line) rather than one big array: candidate documents run
   to 5 MB each, so both backup and restore stream a document at a time instead of
   holding the whole collection in memory. Each line is still complete JSON, so a
   single record can be grepped out by hand.

   READ ONLY — this script never writes to the database.

   Usage:  node scripts/backup.mjs [--out <dir>]
   Needs MONGODB_URI in backend/.env (the same database the server uses).
   Restore with scripts/restore.mjs. */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

const args = process.argv.slice(2);
const outArg = args.indexOf('--out');
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const root = outArg !== -1 && args[outArg + 1]
  ? path.resolve(args[outArg + 1])
  : path.join(SCRIPT_DIR, '..', 'backups');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — put it in backend/.env (the same database the server uses).');
  process.exit(1);
}

const human = (n) => (n > 1e9 ? `${(n / 1e9).toFixed(2)} GB`
  : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB`
    : n > 1e3 ? `${(n / 1e3).toFixed(0)} kB` : `${n} B`);

await mongoose.connect(uri);
const db = mongoose.connection.db;

const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
const dir = path.join(root, stamp);
fs.mkdirSync(dir, { recursive: true });
console.log(`Database ${db.databaseName} → ${dir}\n`);

const names = (await db.listCollections().toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith('system.'))
  .sort();

const manifest = {
  taken_at: new Date().toISOString(),
  database: db.databaseName,
  format: 'ndjson/ejson-canonical',
  collections: {},
};
let totalDocs = 0;
let totalBytes = 0;

for (const name of names) {
  const file = path.join(dir, `${name}.ndjson`);
  const fd = fs.openSync(file, 'w');
  let count = 0;
  try {
    // Cursor, not toArray() — one document in memory at a time.
    for await (const doc of db.collection(name).find({})) {
      fs.writeSync(fd, `${EJSON.stringify(doc, { relaxed: false })}\n`);
      count += 1;
    }
  } finally {
    fs.closeSync(fd);
  }
  const bytes = fs.statSync(file).size;
  manifest.collections[name] = { documents: count, bytes };
  totalDocs += count;
  totalBytes += bytes;
  console.log(`  ${name.padEnd(22)} ${String(count).padStart(6)} docs   ${human(bytes).padStart(9)}`);
}

fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`\n${names.length} collections, ${totalDocs} documents, ${human(totalBytes)} written.`);
const docs = manifest.collections.candidatedocuments;
if (docs) {
  console.log(`Candidate documents (CV PDFs) captured: ${docs.documents} files, ${human(docs.bytes)}.`);
} else {
  console.log('NOTE: no candidatedocuments collection in this database — no CV bytes were captured.');
}
console.log('\nThis folder holds candidate PII, password hashes and CV files — keep it off');
console.log('shared drives and out of git (backend/.gitignore already excludes backups/).');

await mongoose.disconnect();
