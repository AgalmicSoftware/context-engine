import { safeString, safeJsonParse } from './runtimePrimitives.mjs';

// Cloudflare allows 1,000 KV operations per invocation. A bulk get of up to
// 100 keys counts as one, so each listed page of 1,000 keys costs 11.
const BULK_GET_KEYS = 100;

export async function listKvRecordsByPrefix(env = {}, prefix = '', {
  limit = Infinity,
  parseJson = safeJsonParse,
  // Applied as each batch arrives, so only what a caller keeps stays in memory.
  select = (record) => record,
} = {}) {
  const kv = env?.AGENT_ACTION_KV;
  if (!kv || typeof kv.list !== 'function' || typeof kv.get !== 'function') return [];
  const records = [];
  const maxRecords = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.floor(Number(limit))
    : Infinity;
  let cursor = undefined;
  do {
    const page = await kv.list({
      prefix,
      limit: Math.min(1000, Math.max(1, Number.isFinite(maxRecords) ? maxRecords : 1000)),
      ...(cursor ? { cursor } : {}),
    });
    const keys = (Array.isArray(page?.keys) ? page.keys : [])
      .map((entry) => safeString(entry?.name || entry))
      .filter(Boolean);
    for (let offset = 0; offset < keys.length; offset += BULK_GET_KEYS) {
      const batch = keys.slice(offset, offset + BULK_GET_KEYS);
      const values = await kv.get(batch);
      for (const key of batch) {
        const record = parseJson(values.get(key), null);
        if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
        const selected = select({ ...record, key });
        if (selected) records.push(selected);
        if (records.length >= maxRecords) return records;
      }
    }
    cursor = page?.list_complete === false ? safeString(page.cursor) : '';
  } while (cursor);
  return records;
}
