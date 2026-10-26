import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ethers } from 'ethers';

// The agent's own signing key lives in its state directory, readable only by
// its owner. Nothing here ever returns, logs, or echoes the private key, even
// in errors about a damaged key file.
const KEY_FILE = 'agent-key.json';
const STATE_FILE = 'state.json';
const OWNER_ONLY_FILE = 0o600;
const OWNER_ONLY_DIR = 0o700;
const POSIX = process.platform !== 'win32';

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const ensureStateDir = async (stateDir) => {
  await fs.mkdir(stateDir, { recursive: true, mode: OWNER_ONLY_DIR });
  if (!POSIX) return;
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  // A linked state directory is fine, but only through a link the user owns.
  const link = await fs.lstat(stateDir);
  if (link.isSymbolicLink() && uid !== null && link.uid !== uid) {
    throw new Error(`${stateDir} is a link owned by another user. Choose a state directory you own.`);
  }
  const info = await fs.stat(stateDir);
  if (!info.isDirectory()) throw new Error(`${stateDir} is not a directory.`);
  if (uid !== null && info.uid !== uid) {
    throw new Error(`${stateDir} belongs to another user. Choose a state directory you own.`);
  }
  if (info.mode & 0o022) throw new Error(`${stateDir} is writable by other users. Run: chmod 700 "${stateDir}"`);
};

const writeOwnerOnlyJson = async (filePath, value, { exclusive = false } = {}) => {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  if (exclusive) {
    await fs.writeFile(filePath, body, { mode: OWNER_ONLY_FILE, flag: 'wx' });
    return;
  }
  // A fresh, exclusively created temp file cannot follow a planted symlink.
  const temporary = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.writeFile(temporary, body, { mode: OWNER_ONLY_FILE, flag: 'wx' });
  await fs.rename(temporary, filePath);
};

const readKeyFile = async (keyPath) => {
  const info = await fs.lstat(keyPath);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`${keyPath} must be a regular file, not a link.`);
  if (POSIX && info.mode & 0o077) throw new Error(`${keyPath} is readable by other users. Run: chmod 600 "${keyPath}"`);
  let wallet;
  let recordedAddress = '';
  try {
    const record = JSON.parse(await fs.readFile(keyPath, 'utf8'));
    wallet = new ethers.Wallet(record?.privateKey);
    recordedAddress = typeof record?.address === 'string' ? record.address : '';
  } catch {
    // Parsing errors quote their input, so name only the file.
    throw new Error(`${keyPath} is not a valid agent key file. Restore it from a backup, or move it aside to create a new identity.`);
  }
  if (recordedAddress && recordedAddress.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(`${keyPath} records a different address than its key.`);
  }
  return wallet;
};

const loadOrCreateKey = async (stateDir) => {
  const keyPath = path.join(stateDir, KEY_FILE);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return { wallet: await readKeyFile(keyPath), created: false };
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    // Saved state without its key is a partial restore, not first use: a new
    // key would inherit another identity's remembered answers.
    const saved = await readAgentState(stateDir);
    if (saved.address || Object.keys(saved.sessions).length) {
      throw new Error(
        `${keyPath} is missing, but ${STATE_FILE} belongs to ${saved.address ? `agent ${saved.address}` : 'an earlier agent'}. ` +
          `Restore the key from a backup, or move ${STATE_FILE} aside to start as a new agent.`,
      );
    }
    const wallet = ethers.Wallet.createRandom();
    try {
      await writeOwnerOnlyJson(
        keyPath,
        { version: 1, address: wallet.address, privateKey: wallet.privateKey, createdAt: new Date().toISOString() },
        { exclusive: true },
      );
      return { wallet, created: true };
    } catch (error) {
      // Another process created the key first: read that one instead.
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`${keyPath} could not be read or created.`);
};

/** Loads the agent wallet, creating a fresh key on first use, and binds the state file to it. */
export const loadOrCreateWallet = async (stateDir) => {
  await ensureStateDir(stateDir);
  const loaded = await loadOrCreateKey(stateDir);
  await withStateWriter(stateDir, async () => {
    const state = await readAgentState(stateDir);
    if (state.address && state.address.toLowerCase() !== loaded.wallet.address.toLowerCase()) {
      throw new Error(
        `${path.join(stateDir, STATE_FILE)} belongs to agent ${state.address}, but ${KEY_FILE} holds ${loaded.wallet.address}. ` +
          `Restore the matching files, or move ${STATE_FILE} aside to start fresh with this key.`,
      );
    }
    // State written before files were bound to an address adopts the key it is used with.
    if (!state.address) await writeOwnerOnlyJson(path.join(stateDir, STATE_FILE), { ...state, address: loaded.wallet.address });
  });
  return loaded;
};

const emptyState = () => ({ version: 1, address: '', profile: {}, sessions: {}, current: '' });

export const readAgentState = async (stateDir) => {
  let parsed;
  try {
    parsed = JSON.parse(await fs.readFile(path.join(stateDir, STATE_FILE), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyState();
    throw new Error(`${path.join(stateDir, STATE_FILE)} is not valid JSON.`);
  }
  if (!isRecord(parsed)) return emptyState();
  return {
    version: 1,
    // The agent this state belongs to; its remembered answers are that agent's.
    address: typeof parsed.address === 'string' ? parsed.address : '',
    profile: isRecord(parsed.profile) ? parsed.profile : {},
    sessions: isRecord(parsed.sessions) ? parsed.sessions : {},
    current: typeof parsed.current === 'string' ? parsed.current : '',
  };
};

const withStateWriter = async (stateDir, write) => {
  await ensureStateDir(stateDir);
  const lockPath = path.join(stateDir, 'state.lock');
  // Atomic rename prevents torn JSON, but only a lock around read/modify/write
  // prevents a second process from replacing another process's newer state.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.mkdir(lockPath, { mode: OWNER_ONLY_DIR });
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (attempt >= 100) {
        throw new Error(
          `Agent state is busy. Stop every server using ${stateDir}, then remove ${lockPath} if a stopped server left it behind.`,
        );
      }
      await delay(50);
    }
  }
  try {
    return await write();
  } finally {
    await fs.rmdir(lockPath);
  }
};

export const writeAgentState = (stateDir, state) =>
  withStateWriter(stateDir, () =>
    writeOwnerOnlyJson(path.join(stateDir, STATE_FILE), state),
  );

/** Applies a synchronous mutation while holding the state writer lock. */
export const updateAgentState = (stateDir, mutate) =>
  withStateWriter(stateDir, async () => {
    const state = await readAgentState(stateDir);
    mutate(state);
    await writeOwnerOnlyJson(path.join(stateDir, STATE_FILE), state);
    return state;
  });
