/* Restore a backup produced by scripts/backup.mjs.

   Default behaviour is ADDITIVE and non-destructive: every document is upserted
   by _id, so a record that vanished comes back and one that is already there is
   returned to its backed-up state. Nothing in the database is deleted, and
   collections not present in the backup are left completely alone.

   --drop is the destructive option: it empties each restored collection first, so
   the result matches the backup exactly and anything created since is lost. It
   asks for confirmation unless --yes is also passed.

   Usage:
     node scripts/restore.mjs --dry                     # report only, no writes
     node scripts/restore.mjs                           # upsert everything (safe)
     node scripts/restore.mjs --only candidatedocuments # e.g. CV bytes only
     node scripts/restore.mjs --from backups/2026-08-17T09-00-00
     node scripts/restore.mjs --drop --yes              # exact replace (DESTRUCTIVE)

   Without --from, the newest folder under backend/backups is used.
   Needs MONGODB_URI in backend/.env. */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { EJSON } from 'bson';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const dry = flag('--dry');
const drop = flag('--drop');
const assumeYes = flag('--yes');
const only = (value('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const backupsRoot = path.join(SCRIPT_DIR, '..', 'backups');

let dir = value('--from') ? path.resolve(value('--from')) : null;
if (!dir) {
  if (!fs.existsSync(backupsRoot)) {
    console.error(`No backups folder at ${backupsRoot} — run scripts/backup.mjs first, or pass --from <dir>.`);
    process.exit(1);
  }
  const folders = fs.readdirSync(backupsRoot)
    .filter((f) => fs.statSync(path.join(backupsRoot, f)).isDirectory())
    .sort();
  if (!folders.length) {
    console.error(`No backup folders under ${backupsRoot} — run scripts/backup.mjs first.`);
    process.exit(1);
  }
  dir = path.join(backupsRoot, folders[folders.length - 1]); // names sort chronologically
}
if (!fs.existsSync(dir)) {
  console.error(`Backup folder not found: ${dir}`);
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set — put it in backend/.env (the same database the server uses).');
  process.exit(1);
}

const files = fs.readdirSync(dir)
  .filter((f) => f.endsWith('.ndjson'))
  .filter((f) => !only.length || only.includes(path.basename(f, '.ndjson')))
  .sort();

if (!files.length) {
  console.error(`Nothing to restore from ${dir}${only.length ? ` matching --only ${only.join(',')}` : ''}.`);
  process.exit(1);
}

const manifestPath = path.join(dir, 'manifest.json');
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : null;

console.log(`Restoring from ${dir}`);
if (manifest) console.log(`Backup taken ${manifest.taken_at} from database "${manifest.database}"`);
console.log(`Mode: ${dry ? 'DRY RUN — no writes' : drop ? 'DROP + REPLACE (destructive)' : 'upsert by _id (additive, nothing deleted)'}`);
console.log(`Collections: ${files.map((f) => path.basename(f, '.ndjson')).join(', ')}\n`);

if (drop && !dry && !assumeYes) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(
    '--drop empties these collections first. Anything created since the backup is LOST.\nType "drop" to proceed: ', r
  ));
  rl.close();
  if (answer.trim() !== 'drop') {
    console.log('Aborted — nothing was changed.');
    process.exit(0);
  }
}

await mongoose.connect(uri);
const db = mongoose.connection.db;
console.log(`Connected to ${db.databaseName}.\n`);

const BATCH = 200;
let totalRead = 0;
let totalWritten = 0;

for (const file of files) {
  const name = path.basename(file, '.ndjson');
  const coll = db.collection(name);

  if (drop && !dry) {
    // deleteMany rather than drop() so the collection's indexes survive.
    const cleared = await coll.deleteMany({});
    console.log(`  ${name}: cleared ${cleared.deletedCount} existing document(s)`);
  }

  let read = 0;
  let written = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    if (!dry) {
      const res = await coll.bulkWrite(batch, { ordered: false });
      written += (res.upsertedCount || 0) + (res.modifiedCount || 0) + (res.insertedCount || 0);
    } else {
      written += batch.length;
    }
    batch = [];
  };

  // Line-at-a-time so a collection of 5 MB PDFs never lands in memory at once.
  const rl = readline.createInterface({
    input: fs.createReadStream(path.join(dir, file)),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const doc = EJSON.parse(trimmed, { relaxed: false });
    read += 1;
    // replaceOne+upsert restores the document to exactly its backed-up state.
    batch.push({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } });
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  const expected = manifest?.collections?.[name]?.documents;
  const mismatch = expected !== undefined && expected !== read ? `  (manifest says ${expected})` : '';
  console.log(`  ${name.padEnd(22)} ${String(read).padStart(6)} read   ${String(written).padStart(6)} ${dry ? 'would write' : 'written'}${mismatch}`);
  totalRead += read;
  totalWritten += written;
}

console.log(`\n${totalRead} document(s) read, ${totalWritten} ${dry ? 'would be written' : 'written'}.`);
if (dry) console.log('Dry run — the database was not modified. Drop --dry to apply.');

await mongoose.disconnect();
