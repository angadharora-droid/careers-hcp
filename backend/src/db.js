import mongoose from 'mongoose';
import os from 'os';
import path from 'path';

export async function connectDB() {
  let uri = process.env.MONGODB_URI;
  if (!uri || process.env.USE_MEMORY_DB === 'true') {
    // Keep the mongod binary + data outside synced folders (OneDrive) — sync/AV
    // scanning otherwise makes the instance miss its startup timeout on Windows.
    process.env.MONGOMS_DOWNLOAD_DIR ??= path.join(os.tmpdir(), 'cph-mongodb-binaries');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await MongoMemoryServer.create({ instance: { launchTimeout: 120000 } });
    uri = mem.getUri('cph_recruitment');
    console.warn('!  No MONGODB_URI set (or USE_MEMORY_DB=true) — using in-memory MongoDB.');
    console.warn('!  All data resets when the server stops. Set MONGODB_URI in .env for persistence.');
  }
  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
}
