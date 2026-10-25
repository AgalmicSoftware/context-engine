// Registry payloads use public Arweave gateways; no URL supplied by metadata is fetched directly.
export const MAX_REGISTRY_RECORD_BYTES = 256 * 1024;
const GATEWAYS = ['ar-io.dev', 'arweave.net'];
const ID_RE = /^[A-Za-z0-9_-]{43}$/;

const checkedId = (id) => {
  if (typeof id !== 'string' || !ID_RE.test(id) || Buffer.from(id, 'base64url').toString('base64url') !== id) {
    throw new Error('Expected a 43-character Arweave transaction id.');
  }
  return id;
};

export const arweaveIdToHex = (id) => `0x${Buffer.from(checkedId(id), 'base64url').toString('hex')}`;
export const hexToArweaveId = (hex) => {
  if (typeof hex !== 'string' || !/^0x[0-9a-f]{64}$/i.test(hex) || /^0x0+$/.test(hex)) throw new Error('Missing Arweave pointer.');
  return Buffer.from(hex.slice(2), 'hex').toString('base64url');
};

const parseRecord = (raw) => {
  if (Buffer.byteLength(raw) > MAX_REGISTRY_RECORD_BYTES) throw new Error('Arweave record is too large.');
  let result;
  try { result = JSON.parse(raw); } catch { throw new Error('Arweave record is not valid JSON.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Arweave record must be a JSON object.');
  return result;
};

const readLimited = async (response) => {
  if (Number(response.headers.get('content-length')) > MAX_REGISTRY_RECORD_BYTES) throw new Error('Arweave record is too large.');
  if (!response.body?.getReader) return parseRecord(await response.text());
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_REGISTRY_RECORD_BYTES) {
      await reader.cancel().catch(() => {});
      throw new Error('Arweave record is too large.');
    }
    chunks.push(Buffer.from(value));
  }
  return parseRecord(Buffer.concat(chunks).toString('utf8'));
};

const sameGateway = (url, gateway) => url.protocol === 'https:' && !url.username && !url.password &&
  (!url.port || url.port === '443') && (url.hostname === gateway || url.hostname.endsWith(`.${gateway}`));

export const fetchArweaveJson = async (id, { fetchImpl = globalThis.fetch } = {}) => {
  checkedId(id);
  let failure;
  for (const gateway of GATEWAYS) {
    for (const prefix of ['', 'raw/']) {
      let url = new URL(`https://${gateway}/${prefix}${id}`);
      const signal = AbortSignal.timeout(8000);
      try {
        for (let redirects = 0; redirects <= 3; redirects += 1) {
          const response = await fetchImpl(url.toString(), { signal, redirect: 'manual' });
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            await response.body?.cancel().catch(() => {});
            if (!location || redirects === 3) throw new Error('Arweave gateway redirect limit reached.');
            url = new URL(location, url);
            if (!sameGateway(url, gateway)) throw new Error('Arweave gateway redirect left its gateway family.');
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel().catch(() => {});
            throw new Error(`Arweave record is not available yet (${response.status}).`);
          }
          return await readLimited(response);
        }
      } catch (error) { failure = error; }
    }
  }
  throw new Error(failure?.message || 'Arweave record could not be read.');
};

export const readRegistryMetadata = async (uri, options = {}) => {
  if (typeof uri !== 'string' || !uri.trim()) throw new Error('Session metadata is missing.');
  if (Buffer.byteLength(uri) > MAX_REGISTRY_RECORD_BYTES * 3 + 64) throw new Error('Session metadata is too large.');
  const inline = uri.match(/^data:application\/json(?:;charset=utf-8)?(;base64)?,([\s\S]*)$/i);
  if (inline) {
    let raw;
    try { raw = inline[1] ? Buffer.from(inline[2], 'base64').toString('utf8') : decodeURIComponent(inline[2]); }
    catch { throw new Error('Session metadata URI is invalid.'); }
    return parseRecord(raw);
  }
  let id = uri.trim().replace(/^ar:\/\//, '');
  if (/^https:\/\//i.test(id)) {
    const url = new URL(id);
    const match = url.pathname.match(/^\/(?:raw\/)?([A-Za-z0-9_-]{43})\/?$/);
    if (!match) throw new Error('Session metadata URL must contain an Arweave transaction id.');
    id = match[1];
  }
  return fetchArweaveJson(checkedId(id), options);
};
