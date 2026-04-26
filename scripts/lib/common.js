'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const toStr = (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));

const nowTag = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
};

const MONTH_ABBREVS = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

// Human-facing timestamp for resource names (12h clock): DD-Mon-YYYY-HH-MM-AM/PM
const nowHumanTag = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_ABBREVS[d.getMonth()] || String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const minutes = String(d.getMinutes()).padStart(2, '0');

  const h24 = Number(d.getHours()) || 0;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : (h24 % 12);
  const hours = String(h12).padStart(2, '0');

  return `${dd}-${mon}-${yyyy}-${hours}-${minutes}-${ampm}`;
};

const slugify = (value) => (
  toStr(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
);

// Build a stable, human-readable, time-ordered slug like:
// "e2e-gates-20260216-013355-16-feb-2026-01-33-pm"
const buildTimestampedSlug = ({ prefix, runTag, humanTag, suffix } = {}) => {
  const p = slugify(prefix);
  const rt = slugify(runTag || nowTag());
  const ht = slugify(humanTag || nowHumanTag());
  const sfx = slugify(suffix);
  return [p, rt, ht, sfx].filter(Boolean).join('-');
};

const toBool = (value) => {
  const raw = toStr(value).trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y';
};

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(toStr(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseArgs = (argv) => {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
};

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

const writeJson = (filePath, value) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const readJson = (filePath, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
};

const relRoot = (filePath) => path.relative(ROOT, filePath);

const resolveRunTag = (args = {}, env = process.env) => {
  return toStr(args['run-tag'] || env.AI_RUN_TAG || env.RUN_TAG).trim() || nowTag();
};

const resolveArtifacts = ({ runTag, baseName } = {}) => {
  const tag = toStr(runTag).trim() || nowTag();
  const stem = toStr(baseName).trim() || 'e2e-flow';
  return {
    json: path.join(ROOT, 'artifacts', 'session-workflows', `${stem}-${tag}.json`),
    png: path.join(ROOT, 'artifacts', 'screenshots', `${stem}-${tag}.png`),
    errorPng: path.join(ROOT, 'artifacts', 'screenshots', `${stem}-${tag}-error.png`),
  };
};

const createBaseReport = ({ flowId, runner, runTag, chain, inputs, contracts, wallets, outputs } = {}) => ({
  flowId: toStr(flowId).trim() || 'CE-E2E-UNKNOWN',
  runner: toStr(runner).trim() || 'unknown-runner',
  createdAt: new Date().toISOString(),
  runTag: toStr(runTag).trim() || nowTag(),
  chain: chain || {},
  inputs: inputs || {},
  contracts: contracts || {},
  wallets: wallets || {},
  steps: [],
  assertions: [],
  cleanup: { attempted: false, succeeded: false, details: null },
  outputs: outputs || {},
});

const addStep = (report, step) => {
  if (!report || typeof report !== 'object') return;
  if (!Array.isArray(report.steps)) report.steps = [];
  report.steps.push({
    at: new Date().toISOString(),
    ...(step || {}),
  });
};

module.exports = {
  ROOT,
  addStep,
  buildTimestampedSlug,
  createBaseReport,
  ensureDir,
  nowHumanTag,
  nowTag,
  parseArgs,
  readJson,
  relRoot,
  resolveArtifacts,
  resolveRunTag,
  slugify,
  toBool,
  toInt,
  toStr,
  writeJson,
};
