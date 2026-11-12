import {
  CONTEXT_FILE_TYPES,
  CONTEXT_ROLE,
  CONTEXT_TAGS as TAGS,
  CONTEXT_TEXT_ROLE,
  contextRoleOf,
  contextTagValue,
  isAdminsOnlyAccess,
} from '../../shared/sessionContextSources.mjs';
import { buildSessionContextPrompt } from '../../shared/sessionContextText.mjs';
import { metadataAccessMatchesPublishedAudience } from './storageAudience.js';
import { listContextSourceRows, readContextSourceBytes } from './storageRouteExecution.js';
import { isStorageReadLimitError, jsonByteLength, StorageReadLimitError } from './storageScanBudget.js';

const MAX_SOURCES = 16;
const MAX_READ_BYTES = 1024 * 1024;
const SCAN_LIMITS = Object.freeze({ operations: 400, rows: 300, metadataBytes: 1024 * 1024 });
const decoder = new TextDecoder();

const scanBudget = () => {
  const used = { operations: 0, rows: 0, metadataBytes: 0 };
  const take = (kind, amount) => {
    used[kind] += amount;
    if (used[kind] > SCAN_LIMITS[kind]) throw new StorageReadLimitError(kind);
  };
  return {
    operation: () => take('operations', 1),
    rows: (count = 1) => take('rows', count),
    metadata: (value) => take('metadataBytes', jsonByteLength(value)),
  };
};

// Readable by everyone the session admits: its own access exactly, with no
// admins-only or group rule. Anything narrower, or unreadable here, is left out.
export const forEveryone = (row, config) =>
  row.payloadEncrypted !== true &&
  !(Array.isArray(row.groupIds) && row.groupIds.length) &&
  !isAdminsOnlyAccess(row.accessConditions) &&
  metadataAccessMatchesPublishedAudience(row, config);

const createdAtOf = (row) => Date.parse(row.createdAt) || 0;

/**
 * The context sources every participant may read, as texts for the shared
 * prompt block: link snapshots, text files, and the AI's reading of each PDF
 * (an unread PDF gives no text). The Worker's own AI features act for
 * participants, so admins-only items never reach them. `readable(row)`
 * narrows or widens that to one person's access; `principal` names who the
 * read is for in the envelope audit; files added by `leaveOutUploaders`
 * (lower-case addresses) are left out, with the AI's readings of them.
 */
export const loadParticipantContextSources = async ({ env, slug, config, deps, readable, principal, leaveOutUploaders } = {}) => {
  let rows = [];
  try {
    rows = await listContextSourceRows({ env, slug, budget: scanBudget() });
  } catch (error) {
    // The AI call goes ahead without context, but the operator should know why.
    const warn = typeof deps?.log?.warn === 'function' ? deps.log.warn : console.warn;
    warn('[context] sources left out of an AI prompt', {
      slug,
      reason: isStorageReadLimitError(error) ? `${error.kind} limit` : 'storage unavailable',
    });
    return [];
  }
  const canRead = readable || ((row) => forEveryone(row, config));
  const visible = [];
  for (const row of rows) if (await canRead(row)) visible.push(row);
  visible.sort((a, b) => createdAtOf(a) - createdAtOf(b));
  const readings = new Map();
  visible
    .filter((row) => contextRoleOf(row.tags) === CONTEXT_TEXT_ROLE)
    .forEach((row) => readings.set(contextTagValue(row.tags, TAGS.derivedFrom), row));
  const sources = [];
  for (const row of visible) {
    if (sources.length >= MAX_SOURCES) break;
    if (contextRoleOf(row.tags) !== CONTEXT_ROLE) continue;
    if (leaveOutUploaders?.has(String(row.uploader || '').trim().toLowerCase())) continue;
    const isPdf = row.contentType === CONTEXT_FILE_TYPES.pdf;
    const textRow = isPdf ? readings.get(row.id) : row;
    if (!textRow) continue;
    let bytes = null;
    try {
      bytes = await readContextSourceBytes({ env, config, slug, metadata: textRow, maxBytes: MAX_READ_BYTES, principal, deps });
    } catch {
      bytes = null;
    }
    if (!bytes) continue;
    const kind = contextTagValue(row.tags, TAGS.kind) === 'link' ? 'link' : 'file';
    let text = decoder.decode(bytes);
    let url = '';
    if (kind === 'link') {
      try {
        const record = JSON.parse(text);
        text = typeof record?.snapshot?.text === 'string' ? record.snapshot.text : '';
        url = typeof record?.url === 'string' ? record.url : '';
      } catch {
        continue;
      }
    }
    sources.push({ title: contextTagValue(row.tags, TAGS.name), kind, url, text, readByAi: isPdf });
  }
  return sources;
};

/** The session's context block for an AI acting for any participant; '' when none. */
export const buildParticipantContextPrompt = async ({ env, slug, config, deps, totalChars } = {}) => {
  const sources = await loadParticipantContextSources({ env, slug, config, deps });
  return buildSessionContextPrompt({ sessionContext: config?.sessionContext, sources, totalChars }).text;
};
