import fs from 'fs';
import os from 'os';
import path from 'path';

const GLOBAL_DB_PATH_KEY = '__CE_ARWEAVE_DB_PATH__';

const resolveDbPath = () => {
  const globalPath = globalThis && globalThis[GLOBAL_DB_PATH_KEY];
  if (globalPath) return globalPath;
  const envPath = process.env.CE_ARWEAVE_DB_PATH;
  const fallbackPath = path.join(
    os.tmpdir(),
    `contextengine-arweave-${process.pid}-${Date.now()}.json`
  );
  const nextPath = envPath || fallbackPath;
  if (globalThis) {
    globalThis[GLOBAL_DB_PATH_KEY] = nextPath;
  }
  return nextPath;
};

let dbPath = resolveDbPath();

const ensureDb = () => {
  const nextPath = resolveDbPath();
  if (dbPath !== nextPath) {
    dbPath = nextPath;
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '{}', 'utf8');
  }
};

const readDb = () => {
  ensureDb();
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw) || {};
  } catch (_) {
    return {};
  }
};

const writeDb = (payload) => {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(payload || {}), 'utf8');
};

const put = (txId, value) => {
  const db = readDb();
  db[txId] = value;
  writeDb(db);
};

const get = (txId) => {
  const db = readDb();
  return db[txId];
};

const reset = () => writeDb({});

const cleanup = () => {
  try {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  } catch (_) {
    // ignore cleanup failures
  }
};

const getDbPath = () => {
  const nextPath = resolveDbPath();
  if (dbPath !== nextPath) {
    dbPath = nextPath;
  }
  return dbPath;
};
const setDbPath = (nextPath) => {
  dbPath = nextPath;
  if (globalThis) {
    globalThis[GLOBAL_DB_PATH_KEY] = nextPath;
  }
};

export {
  cleanup,
  get,
  getDbPath,
  put,
  readDb,
  reset,
  setDbPath,
  writeDb,
};
