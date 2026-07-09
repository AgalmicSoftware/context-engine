/**
 * @module chainMetadataResolution
 * @description Internal chain metadata decrypt helpers for contractScripts read paths.
 */

import { ethers } from 'ethers';
import store from '../../store';
import { cryptoUtils } from '../crypto/cryptography.js';
import { getGlobalLitHooks } from '../crypto/litProtocol.js';
import { createLogger } from '../logging.js';
import { memoizedResolveSession } from '../cache/contractScriptsCache.js';
import { toStr } from '../shared/primitives.js';
import { normalizeAddress } from './addressNormalization.js';
import { coerceStringArray } from './contractScripts.payloadNormalizers.js';

type UnknownRecord = Record<string, unknown>;
type GateMode = 'any' | 'all';
type DecryptFailureReason =
  | 'missing-chain'
  | 'missing-provider'
  | 'missing-account'
  | 'missing-lit-hooks'
  | 'acc-failed'
  | 'wrong-chain'
  | 'decrypt-failed';
type LitKeyGetter = (...args: unknown[]) => unknown;
type DecryptContext = {
  account: string;
  providerLike: string;
  chainId: number | null;
  litOpts: (UnknownRecord & { getKey: LitKeyGetter }) | null;
  litHooks: unknown;
  preferLitRecipients?: boolean;
};
type DecryptResult = {
  value: unknown;
  error: null | {
    type: string;
    message: string;
    retryable: boolean;
  };
};
type DecryptFailureMeta = {
  field?: unknown;
  slug?: unknown;
  questionId?: unknown;
  surveyId?: unknown;
};
export type MetadataReadOptions = {
  decrypt?: boolean;
  skipDecrypt?: boolean;
  decryptContext?: unknown;
  throwOnFailure?: boolean;
  forceArweaveFetch?: boolean;
  arweaveRetries?: unknown;
  arweaveGatewayTimeoutMs?: unknown;
  [key: string]: unknown;
};
type SbtGate = {
  sbtAddresses: string[];
  mode: GateMode;
};
type UserHasSbt = (...args: unknown[]) => unknown | Promise<unknown>;
type MetadataResolutionDeps = {
  userHasSBT: UserHasSbt;
};
type GateCheckInput = {
  account?: unknown;
  chainId?: unknown;
  gate: SbtGate;
  groupKeyOrCfg?: unknown;
};
type GateDecryptInput = {
  payload: UnknownRecord;
  encryptedFields: unknown[];
  ctx: DecryptContext;
  groupKeyOrCfg?: unknown;
};

const contractsLog = createLogger('contracts');
const MAX_CACHE_SIZE = 500;
const SBT_GATE_ACCESS_TTL_MS = 30000;
const SBT_GATE_ACCESS_ERROR_TTL_MS = 3000;
const _encryptedValueCache = new Map<string, DecryptResult>();
const _decryptFailureLogCache = new Set<string>();
const _sbtGateAccessCache = new Map<string, { ts: number; value: boolean }>();
const _sbtGateAccessErrorCache = new Map<string, { ts: number }>();
const _sbtGateAccessInFlight = new Map<string, Promise<boolean | null>>();

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const toLower = (value: unknown): string => toStr(value).trim().toLowerCase();

const errorText = (error: unknown): string => {
  if (!isRecord(error)) return toStr(error);
  return toStr(error.message ?? error.reason ?? '');
};

const getRecord = (value: unknown): UnknownRecord | null => (isRecord(value) ? value : null);

const getLitGetKey = (ctx: unknown = {}): LitKeyGetter | null => {
  const record = getRecord(ctx) || {};
  const litOpts = getRecord(record.litOpts);
  if (typeof litOpts?.getKey === 'function') return litOpts.getKey as LitKeyGetter;
  const litHooks = getRecord(record.litHooks);
  if (typeof litHooks?.getKey === 'function') return litHooks.getKey as LitKeyGetter;
  const lit = getRecord(record.lit);
  if (typeof lit?.getKey === 'function') return lit.getKey as LitKeyGetter;
  return null;
};

const buildDecryptContextTag = (ctx: Partial<DecryptContext> = {}): string => {
  const account = normalizeAddress(ctx.account || '');
  const providerLike = toLower(ctx.providerLike || '');
  const chainId = Number(ctx.chainId || 0) || 0;
  const hasLitGetKey = !!getLitGetKey(ctx);
  const preferLitRecipients = ctx.preferLitRecipients ? '1' : '0';
  return `${account}|${providerLike}|${chainId}|lit:${hasLitGetKey ? '1' : '0'}|litFirst:${preferLitRecipients}`;
};

const resolveDefaultProviderLike = (): string => {
  try {
    const state = store?.getState ? store.getState() : null;
    const profile = getRecord(getRecord(state)?.profile);
    const fromStore = toStr(profile?.provider || '').trim();
    if (fromStore) return fromStore;
  } catch (err: unknown) {
    contractsLog.debug('resolveDefaultProviderLike error:', err);
  }

  if (typeof window !== 'undefined') {
    const browserWindow = window as Window & {
      __passkeyEoaProvider?: { isPasskeyEoa?: boolean };
      ethereum?: unknown;
      web3authProvider?: unknown;
    };
    if (browserWindow.__passkeyEoaProvider?.isPasskeyEoa) return 'passkey_eoa';
    if (browserWindow.ethereum) return 'wagmi';
    if (browserWindow.web3authProvider) return 'web3auth';
  }

  return 'passkey_eoa';
};

const classifyDecryptFailure = (err: unknown, ctx: Partial<DecryptContext> = {}): DecryptFailureReason => {
  const msg = toLower(errorText(err));
  if (!ctx.chainId) return 'missing-chain';
  if (!ctx.providerLike) return 'missing-provider';
  if (!ctx.account) return 'missing-account';
  if (!getLitGetKey(ctx)) return 'missing-lit-hooks';
  if (
    msg.includes('access control') ||
    msg.includes('unable to unwrap cek') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('auth sig')
  ) {
    return 'acc-failed';
  }
  if (msg.includes('wrong chain') || msg.includes('wrong network') || msg.includes('chain mismatch')) {
    return 'wrong-chain';
  }
  return 'decrypt-failed';
};

const getDecryptFailureMessage = (reason: DecryptFailureReason): string => {
  switch (reason) {
    case 'missing-chain':
      return 'Missing chainId for decrypt context.';
    case 'missing-provider':
      return 'Missing provider for decrypt context.';
    case 'missing-account':
      return 'Missing account for decrypt context.';
    case 'missing-lit-hooks':
      return 'Missing Lit hooks for decrypt context.';
    case 'acc-failed':
      return 'Lit access control check failed.';
    case 'wrong-chain':
      return 'Decrypt attempted on the wrong network.';
    case 'decrypt-failed':
      return 'Encrypted payload failed integrity checks.';
    default:
      return 'Unknown decrypt failure.';
  }
};

const buildDecryptFailureResult = (reason: DecryptFailureReason, err: unknown = null): DecryptResult => {
  let type = 'unknown';
  let retryable = false;
  switch (reason) {
    case 'missing-chain':
    case 'missing-provider':
    case 'missing-account':
    case 'missing-lit-hooks':
      type = 'key_unavailable';
      retryable = true;
      break;
    case 'acc-failed':
      type = 'lit_failure';
      break;
    case 'wrong-chain':
      type = 'network';
      retryable = true;
      break;
    case 'decrypt-failed':
      type = 'aes_integrity';
      break;
    default:
      type = 'unknown';
      break;
  }
  return {
    value: null,
    error: {
      type,
      message: errorText(err) || getDecryptFailureMessage(reason),
      retryable,
    },
  };
};

const logDecryptFailure = (
  reason: DecryptFailureReason,
  err: unknown,
  meta: DecryptFailureMeta = {},
  ctx: Partial<DecryptContext> = {},
): void => {
  const key = `${reason}|${toStr(meta.field)}|${toStr(meta.slug)}|${toStr(meta.questionId)}|${buildDecryptContextTag(ctx)}`;
  if (_decryptFailureLogCache.has(key)) return;
  if (_decryptFailureLogCache.size >= MAX_CACHE_SIZE) {
    const oldest = _decryptFailureLogCache.values().next().value;
    if (oldest) _decryptFailureLogCache.delete(oldest);
  }
  _decryptFailureLogCache.add(key);
  contractsLog.debug('[decrypt] question metadata decrypt skipped', {
    reason,
    field: meta.field || undefined,
    questionId: meta.questionId || undefined,
    slug: meta.slug || undefined,
    chainId: ctx.chainId || undefined,
    hasAccount: !!ctx.account,
    providerLike: ctx.providerLike || undefined,
    hasLitGetKey: !!getLitGetKey(ctx),
    error: errorText(err) || undefined,
  });
};

const getDecryptContext = (groupCfg: unknown = null, context: unknown = null): DecryptContext => {
  const ctxIn = getRecord(context) || {};
  let account = toStr(ctxIn.account || '').trim();
  let providerLike = toStr(ctxIn.providerLike || ctxIn.provider || '').trim();
  let chainId: number | null = Number(ctxIn.chainId || 0) || null;

  try {
    const state = store?.getState ? store.getState() : null;
    const profile = getRecord(getRecord(state)?.profile);
    const network = getRecord(profile?.network);
    if (!account) account = toStr(profile?.account || '');
    if (!providerLike) providerLike = toStr(profile?.provider || '').trim();
    if (!chainId) chainId = Number(network?.id || network?.chainId || 0) || null;
  } catch (err: unknown) {
    contractsLog.debug('getDecryptContext error:', err);
  }

  if (!providerLike) providerLike = resolveDefaultProviderLike();

  const groupChainId = Number(getRecord(groupCfg)?.networkChainId || 0) || undefined;
  if (groupChainId) chainId = groupChainId;

  const litHooks = ctxIn.litHooks || ctxIn.lit || getGlobalLitHooks();
  const litOptsInput = getRecord(ctxIn.litOpts);
  const litGetKey =
    typeof litOptsInput?.getKey === 'function' ? (litOptsInput.getKey as LitKeyGetter) : getLitGetKey({ litHooks });

  const litOpts = litGetKey
    ? {
        ...(litOptsInput || {}),
        getKey: litGetKey,
      }
    : null;

  return { account, providerLike, chainId, litOpts, litHooks };
};

const decryptEnvelopeCached = async (
  envelopeJson: unknown,
  ctx: DecryptContext,
  meta: DecryptFailureMeta = {},
): Promise<DecryptResult> => {
  if (!envelopeJson) return { value: null, error: null };
  const key = typeof envelopeJson === 'string' ? envelopeJson : JSON.stringify(envelopeJson || {});
  const cacheKey = `${buildDecryptContextTag(ctx)}::${key}`;
  const cached = _encryptedValueCache.get(cacheKey);
  if (cached) return cached;

  const hasLitGetKey = !!getLitGetKey(ctx);
  const hasSignerCtx = !!(ctx.account && ctx.providerLike);
  if (!ctx || (!hasSignerCtx && !hasLitGetKey)) {
    const reason = classifyDecryptFailure(null, ctx || {});
    logDecryptFailure(reason, null, meta, ctx);
    return buildDecryptFailureResult(reason);
  }
  if (!ctx.account) {
    const reason = 'missing-account';
    logDecryptFailure(reason, null, meta, ctx);
    return buildDecryptFailureResult(reason);
  }
  if (!ctx.chainId) {
    const reason = 'missing-chain';
    logDecryptFailure(reason, null, meta, ctx);
    return buildDecryptFailureResult(reason);
  }
  if (!ctx.providerLike && !hasLitGetKey) {
    const reason = 'missing-provider';
    logDecryptFailure(reason, null, meta, ctx);
    return buildDecryptFailureResult(reason);
  }

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
      account: ctx.account,
      chainId: ctx.chainId,
      providerLike: ctx.providerLike,
      litOpts: ctx.litOpts || undefined,
      preferLitRecipients: !!ctx.preferLitRecipients,
    });
    if (_encryptedValueCache.size >= MAX_CACHE_SIZE) {
      const oldest = _encryptedValueCache.keys().next().value;
      if (oldest) _encryptedValueCache.delete(oldest);
    }
    const result: DecryptResult = { value, error: null };
    _encryptedValueCache.set(cacheKey, result);
    return result;
  } catch (err: unknown) {
    const reason = classifyDecryptFailure(err, ctx);
    logDecryptFailure(reason, err, meta, ctx);
    contractsLog.debug('decryptEnvelopeCached error:', errorText(err) || err);
    return buildDecryptFailureResult(reason, err);
  }
};

const shouldPreferLitRecipientsForPayload = (payload: UnknownRecord, ctx: DecryptContext): boolean => {
  const accountLower = toLower(ctx.account || '');
  const creatorLower = normalizeAddress(payload.creator || payload.creatorAddress || '');
  return !!(accountLower && creatorLower && accountLower !== creatorLower && getLitGetKey(ctx));
};

const normalizeGateMode = (gate: unknown = {}): GateMode => {
  try {
    const record = getRecord(gate) || {};
    if (record.requireAll === true) return 'all';
    const raw = toLower(record.mode || record.operator || record.gateMode || record.require || '');
    if (raw === 'all' || raw === 'and' || raw === '1') return 'all';
  } catch (err: unknown) {
    contractsLog.debug('normalizeGateMode error:', err);
  }
  return 'any';
};

const getGateSbtAddresses = (gate: unknown = {}): string[] => {
  const record = getRecord(gate) || {};
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (addr: unknown): void => {
    try {
      const value = toStr(addr).trim();
      if (!ethers.utils.isAddress(value)) return;
      const lower = normalizeAddress(value);
      if (seen.has(lower)) return;
      seen.add(lower);
      out.push(lower);
    } catch (err: unknown) {
      contractsLog.debug('getGateSbtAddresses error:', err);
    }
  };
  try {
    if (Array.isArray(record.sbtAddresses)) record.sbtAddresses.forEach(push);
    if (record.sbtAddress) push(record.sbtAddress);
  } catch (err: unknown) {
    contractsLog.debug('getGateSbtAddresses error:', err);
  }
  return out;
};

const extractSbtGateFromAccConditions = (accessControlConditions: unknown): SbtGate | null => {
  const conds = Array.isArray(accessControlConditions) ? accessControlConditions : [];
  if (!conds.length) return null;

  const sbtAddresses: string[] = [];
  const seen = new Set<string>();
  const operators = new Set<'and' | 'or'>();

  conds.forEach((entryValue: unknown) => {
    const entry = getRecord(entryValue);
    if (!entry) return;

    const op = entry.operator;
    if (op) {
      const normalized = toLower(op);
      if (normalized === 'and' || normalized === 'or') operators.add(normalized);
      return;
    }

    const method = toLower(entry.method);
    if (method !== 'balanceof') return;

    const addr = toStr(entry.contractAddress).trim();
    if (!ethers.utils.isAddress(addr)) return;

    const params = Array.isArray(entry.parameters) ? entry.parameters : [];
    const hasUserParam = params.some((p) => toStr(p).trim() === ':userAddress');
    if (!hasUserParam) return;
    const returnValueTest = getRecord(entry.returnValueTest);
    const cmp = toStr(returnValueTest?.comparator || '').trim();
    const val = toStr(returnValueTest?.value || '').trim();
    if (cmp && cmp !== '>') return;
    if (val && val !== '0') return;

    const lower = normalizeAddress(addr);
    if (seen.has(lower)) return;
    seen.add(lower);
    sbtAddresses.push(lower);
  });

  if (!sbtAddresses.length) return null;
  const mode = operators.has('and') ? 'all' : 'any';
  if (operators.has('and') && operators.has('or')) return null;
  return { sbtAddresses, mode };
};

const extractSbtGatesFromEnvelope = (envelopeJson: unknown): SbtGate[] => {
  if (!envelopeJson) return [];
  let env: unknown;
  try {
    env = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson || null;
  } catch (err: unknown) {
    contractsLog.debug('extractSbtGatesFromEnvelope error:', err);
    return [];
  }

  const envRecord = getRecord(env);
  const recipients = Array.isArray(envRecord?.recipients) ? envRecord.recipients : [];
  const out: SbtGate[] = [];
  const dedupe = new Set<string>();

  recipients.forEach((recipientValue: unknown) => {
    const recipient = getRecord(recipientValue);
    const lit = getRecord(recipient?.lit);
    if (!recipient || recipient.type !== 'lit-sbt-v1' || !lit) return;
    const gate = extractSbtGateFromAccConditions(lit.accessControlConditions);
    if (!gate) return;
    const sig = `${gate.mode}:${gate.sbtAddresses
      .map((a) => a.toLowerCase())
      .sort()
      .join('|')}`;
    if (dedupe.has(sig)) return;
    dedupe.add(sig);
    out.push({ ...gate });
  });

  return out;
};

const extractSbtGatesFromEncryptionMeta = (payload: UnknownRecord = {}): SbtGate[] => {
  const enc = getRecord(payload.encryption);
  if (!enc || enc.enabled === false) return [];

  const gates = Array.isArray(enc.gates) ? enc.gates.filter(Boolean) : isRecord(enc.gate) ? [enc.gate] : [];
  if (!gates.length) return [];

  const out: SbtGate[] = [];
  const dedupe = new Set<string>();
  gates.forEach((gate: unknown) => {
    const sbtAddresses = getGateSbtAddresses(gate);
    if (!sbtAddresses.length) return;
    const mode = normalizeGateMode(gate);
    const sig = `${mode}:${sbtAddresses
      .map((a) => a.toLowerCase())
      .sort()
      .join('|')}`;
    if (dedupe.has(sig)) return;
    dedupe.add(sig);
    out.push({ sbtAddresses, mode });
  });
  return out;
};

export const buildDecryptModeTag = (opts: MetadataReadOptions = {}): string => {
  const skipDecrypt = !!(opts && (opts.skipDecrypt || opts.decrypt === false));
  if (skipDecrypt) return 'raw';
  const ctx = getRecord(opts.decryptContext) || {};
  const account = normalizeAddress(ctx.account || '');
  const providerLike = toStr(ctx.providerLike || '')
    .trim()
    .toLowerCase();
  const chainId = Number(ctx.chainId || 0) || 0;
  const hasLit = !!getLitGetKey({
    litOpts: ctx.litOpts,
    litHooks: ctx.litHooks,
    lit: ctx.lit,
  });
  return `decrypt|${account}|${providerLike}|${chainId}|lit:${hasLit ? '1' : '0'}`;
};

export const buildFailureModeTag = (opts: MetadataReadOptions = {}): string =>
  opts && opts.throwOnFailure ? 'strict' : 'soft';

export const buildArweaveReadModeTag = (opts: MetadataReadOptions = {}): string => {
  const retries = Number.isFinite(Number(opts.arweaveRetries)) ? Math.max(0, Number(opts.arweaveRetries)) : 'default';
  const gatewayTimeoutMs = Number.isFinite(Number(opts.arweaveGatewayTimeoutMs))
    ? Math.max(300, Number(opts.arweaveGatewayTimeoutMs))
    : 'default';
  return `arweave|retries:${retries}|timeout:${gatewayTimeoutMs}`;
};

export const createChainMetadataResolutionHelpers = (deps: MetadataResolutionDeps) => {
  const checkAccountSatisfiesSbtGate = async ({
    account,
    chainId,
    gate,
    groupKeyOrCfg,
  }: GateCheckInput): Promise<boolean | null> => {
    const acct = normalizeAddress(account || '');
    if (!acct || !ethers.utils.isAddress(acct)) return false;
    const sbtAddresses = Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : [];
    if (!sbtAddresses.length) return false;
    const mode = gate.mode === 'all' ? 'all' : 'any';
    const normalizedSbtAddresses = sbtAddresses.map((a) => normalizeAddress(a)).filter(Boolean);
    if (!normalizedSbtAddresses.length) return false;
    const addressesKey = normalizedSbtAddresses.slice().sort().join('|');
    const cacheKey = `${acct}:${String(chainId || '')}:${mode}:${addressesKey}`;

    const cached = _sbtGateAccessCache.get(cacheKey);
    if (cached) {
      const ts = Number(cached.ts || 0);
      if (ts && Date.now() - ts < SBT_GATE_ACCESS_TTL_MS) return !!cached.value;
      _sbtGateAccessCache.delete(cacheKey);
    }
    const errCached = _sbtGateAccessErrorCache.get(cacheKey);
    if (errCached) {
      const ts = Number(errCached.ts || 0);
      if (ts && Date.now() - ts < SBT_GATE_ACCESS_ERROR_TTL_MS) return null;
      _sbtGateAccessErrorCache.delete(cacheKey);
    }
    const inflight = _sbtGateAccessInFlight.get(cacheKey);
    if (inflight) return await inflight;

    const run = (async () => {
      try {
        const checks = await Promise.all(
          normalizedSbtAddresses.map((addr) => deps.userHasSBT('none', addr, acct, 0, 'latest', groupKeyOrCfg)),
        );
        const has = mode === 'all' ? checks.every(Boolean) : checks.some(Boolean);
        _sbtGateAccessCache.set(cacheKey, { ts: Date.now(), value: has });
        _sbtGateAccessErrorCache.delete(cacheKey);
        return has;
      } catch (error: unknown) {
        contractsLog.debug('checkAccountSatisfiesSbtGate error:', error);
        _sbtGateAccessErrorCache.set(cacheKey, { ts: Date.now() });
        return null;
      }
    })();

    _sbtGateAccessInFlight.set(cacheKey, run);
    try {
      return await run;
    } finally {
      if (_sbtGateAccessInFlight.get(cacheKey) === run) {
        _sbtGateAccessInFlight.delete(cacheKey);
      }
    }
  };

  const shouldAttemptGateDecrypt = async ({
    payload,
    encryptedFields,
    ctx,
    groupKeyOrCfg,
  }: GateDecryptInput): Promise<boolean> => {
    const accountLower = toLower(ctx.account || '');
    const creatorLower = normalizeAddress(payload.creator || payload.creatorAddress || '');
    if (accountLower && creatorLower && accountLower === creatorLower) return true;

    if (!getLitGetKey(ctx)) return false;

    const chainId = Number(ctx.chainId || 0) || null;
    let gates = extractSbtGatesFromEncryptionMeta(payload);

    if (!gates.length) {
      for (const field of encryptedFields) {
        const extracted = extractSbtGatesFromEnvelope(field);
        if (extracted.length) {
          gates = extracted;
          break;
        }
      }
    }

    if (!gates.length) return true;

    let hasUnknownGate = false;
    for (const gate of gates) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await checkAccountSatisfiesSbtGate({
        account: ctx.account,
        chainId,
        gate,
        groupKeyOrCfg,
      });
      if (ok === true) return true;
      if (ok == null) hasUnknownGate = true;
    }

    return hasUnknownGate;
  };

  const maybeDecryptSurveyPayload = async <T>(
    surveyData: T,
    groupKeyOrCfg: unknown,
    opts: MetadataReadOptions = {},
  ): Promise<T> => {
    const surveyRecord = getRecord(surveyData);
    if (!surveyRecord) return surveyData;
    const encryptedTitle = surveyRecord.titleEncrypted || surveyRecord.encryptedTitle || null;
    const encryptedDocs = surveyRecord.documentURLsEncrypted || surveyRecord.docUrlsEncrypted || null;
    if (!encryptedTitle && !encryptedDocs) return surveyData;

    const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const cfgRecord = getRecord(cfg) || {};
    const ctx = getDecryptContext(cfg, opts.decryptContext || null);
    const decryptCtx = shouldPreferLitRecipientsForPayload(surveyRecord, ctx)
      ? { ...ctx, preferLitRecipients: true }
      : ctx;

    const shouldAttempt = await shouldAttemptGateDecrypt({
      payload: surveyRecord,
      encryptedFields: [encryptedTitle, encryptedDocs],
      ctx: decryptCtx,
      groupKeyOrCfg: cfg,
    });
    if (!shouldAttempt) {
      logDecryptFailure(
        'acc-failed',
        null,
        {
          field: 'survey',
          slug: cfgRecord.slug || '',
          surveyId: surveyRecord.id || '',
        },
        decryptCtx,
      );
      return surveyData;
    }

    if (encryptedTitle) {
      const result = await decryptEnvelopeCached(encryptedTitle, decryptCtx, {
        field: 'title',
        slug: cfgRecord.slug || '',
        surveyId: surveyRecord.id || '',
      });
      if (result.error) {
        surveyRecord.titleDecryptError = result.error.type;
      } else if (result.value !== null && result.value !== undefined && result.value !== '') {
        surveyRecord.title = String(result.value);
        surveyRecord.titleDecrypted = true;
      }
    }

    if (encryptedDocs) {
      const result = await decryptEnvelopeCached(encryptedDocs, decryptCtx, {
        field: 'documentURLs',
        slug: cfgRecord.slug || '',
        surveyId: surveyRecord.id || '',
      });
      if (result.error) {
        surveyRecord.docsUrlsDecryptError = result.error.type;
      } else {
        const urls = coerceStringArray(result.value);
        if (urls.length) {
          surveyRecord.documentURLs = urls;
          surveyRecord.documentURLsDecrypted = true;
        }
      }
    }

    return surveyData;
  };

  const maybeDecryptQuestionPayload = async <T>(
    questionData: T,
    groupKeyOrCfg: unknown,
    opts: MetadataReadOptions = {},
  ): Promise<T> => {
    const questionRecord = getRecord(questionData);
    if (!questionRecord) return questionData;
    const encryptedPrompt = questionRecord.promptEncrypted || questionRecord.encryptedPrompt || null;
    const encryptedOptions = questionRecord.optionsEncrypted || questionRecord.encryptedOptions || null;
    const encryptedTags = questionRecord.tagsEncrypted || questionRecord.encryptedTags || null;
    if (!encryptedPrompt && !encryptedOptions && !encryptedTags) return questionData;

    const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const cfgRecord = getRecord(cfg) || {};
    const ctx = getDecryptContext(cfg, opts.decryptContext || null);
    const decryptCtx = shouldPreferLitRecipientsForPayload(questionRecord, ctx)
      ? { ...ctx, preferLitRecipients: true }
      : ctx;

    const shouldAttempt = await shouldAttemptGateDecrypt({
      payload: questionRecord,
      encryptedFields: [encryptedPrompt, encryptedOptions, encryptedTags],
      ctx: decryptCtx,
      groupKeyOrCfg: cfg,
    });
    if (!shouldAttempt) {
      logDecryptFailure(
        'acc-failed',
        null,
        {
          field: 'question',
          slug: cfgRecord.slug || '',
          questionId: questionRecord.id || '',
        },
        decryptCtx,
      );
      return questionData;
    }

    if (encryptedPrompt) {
      const result = await decryptEnvelopeCached(encryptedPrompt, decryptCtx, {
        field: 'prompt',
        slug: cfgRecord.slug || '',
        questionId: questionRecord.id || '',
      });
      if (result.error) {
        questionRecord.promptDecryptError = result.error.type;
      } else if (result.value !== null && result.value !== undefined && result.value !== '') {
        questionRecord.prompt = String(result.value);
        questionRecord.promptDecrypted = true;
      }
    }

    if (encryptedOptions) {
      const result = await decryptEnvelopeCached(encryptedOptions, decryptCtx, {
        field: 'options',
        slug: cfgRecord.slug || '',
        questionId: questionRecord.id || '',
      });
      if (result.error) {
        questionRecord.optionsDecryptError = result.error.type;
      } else {
        const options = coerceStringArray(result.value);
        if (options.length) {
          questionRecord.options = options;
          questionRecord.optionsDecrypted = true;
        }
      }
    }

    if (encryptedTags) {
      const result = await decryptEnvelopeCached(encryptedTags, decryptCtx, {
        field: 'tags',
        slug: cfgRecord.slug || '',
        questionId: questionRecord.id || '',
      });
      if (result.error) {
        questionRecord.tagsDecryptError = result.error.type;
      } else {
        const tags = coerceStringArray(result.value);
        if (tags.length) {
          questionRecord.tags = tags;
          questionRecord.tagsDecrypted = true;
        }
      }
    }

    return questionData;
  };

  return {
    maybeDecryptSurveyPayload,
    maybeDecryptQuestionPayload,
  };
};
