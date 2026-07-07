import { normalizeArweaveAssociationTags } from './arweaveAssociationNormalization.js';
import { normalizeArweaveCeTags } from './arweaveCeTagNormalization.js';
import { resolveArweaveUploadJwk } from './arweaveJwkNormalization.js';
import { readArweaveUploadRequestPayload } from './arweaveUploadRequestNormalization.js';
import { resolveMaxUploadBytes } from './uploadSizeLimits.js';

const ARWEAVE_UNAVAILABLE_ERROR = 'Arweave library not available in this runtime (check bundling and try arweave/web).';

const getDefaultArweaveCtorCandidates = () => ([
  { name: 'arweave/web', loader: async () => await import('arweave/web') },
  { name: 'arweave', loader: async () => await import('arweave') },
]);

const resolveCtorFromModule = (moduleValue) => (
  (moduleValue && typeof moduleValue.init === 'function' ? moduleValue : null) ||
  (moduleValue?.default && typeof moduleValue.default.init === 'function' ? moduleValue.default : null) ||
  (moduleValue?.Arweave && typeof moduleValue.Arweave.init === 'function' ? moduleValue.Arweave : null) ||
  (moduleValue?.default?.Arweave && typeof moduleValue.default.Arweave.init === 'function' ? moduleValue.default.Arweave : null) ||
  (moduleValue?.default?.default && typeof moduleValue.default.default.init === 'function' ? moduleValue.default.default : null)
);

const toTrimmedString = (value, deps) => (
  deps?.toStr
    ? deps.toStr(value).trim()
    : (typeof value === 'string' ? value : value == null ? '' : String(value)).trim()
);

const noop = () => {};
const resolveLog = (deps) => (typeof deps?.log === 'function' ? deps.log : noop);
const resolveWarn = (deps) => (
  (typeof deps?.log?.warn === 'function' ? deps.log.warn : null) ||
  (typeof deps?.warn === 'function' ? deps.warn : null) ||
  (typeof deps?.log === 'function' ? deps.log : null) ||
  console.warn
);
const resolveError = (deps) => (
  (typeof deps?.log?.error === 'function' ? deps.log.error : null) ||
  (typeof deps?.error === 'function' ? deps.error : null) ||
  (typeof deps?.log === 'function' ? deps.log : null) ||
  console.error
);

const uploadTransactionWithFallback = async ({ arweave, tx, deps }) => {
  try {
    const uploader = await arweave.transactions.getUploader(tx);
    while (!uploader.isComplete) {
      // eslint-disable-next-line no-await-in-loop
      await uploader.uploadChunk();
    }
    return;
  } catch {
    const res = await arweave.transactions.post(tx);
    if (res?.status === 200 || res?.status === 202) {
      return;
    }

    const status = res?.status || 'unknown';
    const statusText = toTrimmedString(res?.statusText || '', deps);
    let responseBody = '';
    if (typeof res?.text === 'function') {
      try {
        responseBody = toTrimmedString(await res.text(), deps);
      } catch {
        responseBody = '';
      }
    } else if (res && Object.prototype.hasOwnProperty.call(res, 'data')) {
      try {
        responseBody = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      } catch {
        responseBody = '';
      }
    }
    const detail = [statusText, responseBody.slice(0, 300)].filter(Boolean).join(' | ');
    throw new Error(`Arweave post failed (${status})${detail ? `: ${detail}` : ''}`);
  }
};

export const resolveArweaveCtor = async ({ deps } = {}) => {
  const log = resolveLog(deps);
  const error = resolveError(deps);
  const candidates = deps?.arweaveCtorCandidates || getDefaultArweaveCtorCandidates();

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const moduleValue = await candidate.loader();
      const ctor = resolveCtorFromModule(moduleValue);
      if (ctor) {
        log('[arweave] module resolved', { source: candidate.name });
        return ctor;
      }
    } catch {
      // try next
    }
  }

  error('[arweave] module resolved', { source: 'none' });
  return null;
};

export const arweaveUpload = async ({
  request,
  env,
  secrets,
  baseHeaders,
  config,
  slug,
  uploaderAddress,
  deps,
} = {}) => {
  const log = resolveLog(deps);
  const warn = resolveWarn(deps);
  const error = resolveError(deps);
  const json = deps?.json;
  const hasAuthHeader = !!request?.headers?.get?.('authorization');
  const maxUploadBytes = resolveMaxUploadBytes({ env, deps });
  const uploadPayload = await (
    deps?.readArweaveUploadRequestPayload || readArweaveUploadRequestPayload
  )(request, { maxUploadBytes });
  if (!uploadPayload?.ok) {
    return json?.({ error: uploadPayload?.error }, uploadPayload?.status || 400, baseHeaders);
  }

  const {
    bytes,
    contentType,
    providedJwk = null,
    requestId = '',
    tagsInput = null,
  } = uploadPayload.payload || {};

  const Arweave = await (deps?.resolveArweaveCtor || resolveArweaveCtor)({ deps });
  if (!Arweave) {
    return json?.({ error: ARWEAVE_UNAVAILABLE_ERROR }, 500, baseHeaders);
  }

  const jwkResult = (deps?.resolveArweaveUploadJwk || resolveArweaveUploadJwk)({ providedJwk, secrets });
  if (!jwkResult?.ok) {
    return json?.({ error: jwkResult?.error }, 500, baseHeaders);
  }
  const { jwk, hasProvidedJwk, hasWorkerJwk } = jwkResult;

  const tagCheck = (deps?.normalizeArweaveCeTags || normalizeArweaveCeTags)(tagsInput);
  if (!tagCheck?.ok) {
    warn('[arweave] tag reject', { requestId: requestId || null, error: tagCheck?.error });
    return json?.({ error: tagCheck?.error || 'Invalid tags.' }, 400, baseHeaders);
  }
  const tags = tagCheck?.tags || [];

  const association = await (deps?.normalizeArweaveAssociationTags || normalizeArweaveAssociationTags)({
    tags,
    slug,
    config,
    uploaderAddress,
    deps,
  });
  if (!association?.ok) {
    if (association?.reason === 'session-id-resolve') {
      warn('[arweave] sessionId resolve failed', {
        requestId: requestId || null,
        slug: slug || '',
        error: association?.error || '',
      });
    } else if (association?.reason === 'sbt-association') {
      warn('[arweave] sbt assoc reject', {
        requestId: requestId || null,
        error: association?.error || '',
      });
    }
    return json?.(
      { error: association?.error || 'SBT association authorization failed.' },
      association?.status || 403,
      baseHeaders,
    );
  }

  try {
    const arweave = Arweave.init({
      host: 'arweave.net',
      port: 443,
      protocol: 'https',
      timeout: 60000,
      connectTimeout: 60000,
      logging: false,
    });
    log('[arweave] upload start', {
      requestId: requestId || null,
      contentType,
      size: bytes?.length || 0,
      hasProvidedJwk,
      hasWorkerJwk: !hasProvidedJwk && hasWorkerJwk,
      hasAuthHeader,
      tags: tags.length,
    });

    const tx = await arweave.createTransaction({ data: bytes }, jwk);
    if (contentType) tx.addTag('Content-Type', contentType);
    tx.addTag('App-Name', 'ContextEngine');
    tags.forEach((tag) => {
      try {
        tx.addTag(tag.name, tag.value);
      } catch {
        // ignore invalid tag add; validated already
      }
    });
    await arweave.transactions.sign(tx, jwk);
    await uploadTransactionWithFallback({ arweave, tx, deps });

    log('[arweave] upload success', { requestId: requestId || null, id: tx.id });
    return json?.({ id: tx.id }, 200, baseHeaders);
  } catch (e) {
    error('[arweave] upload error', {
      requestId: requestId || null,
      message: e?.message || 'Arweave upload failed',
      stack: e?.stack,
    });
    return json?.({ error: e?.message || 'Arweave upload failed' }, 500, baseHeaders);
  }
};
