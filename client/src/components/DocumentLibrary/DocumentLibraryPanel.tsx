/** @file DocumentLibraryPanel.tsx */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner,
  faSync,
  faUpload,
  faLink,
  faLock,
  faLockOpen,
  faEye,
  faCopy,
  faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Input, Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './DocumentLibraryPanel.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { DOC_LIBRARY_ARWEAVE_GATEWAYS } from '../../variables/arweaveGateways.js';

import { arweaveScripts } from '../../utilities/arweave/arweaveScripts.js';
import {
  buildSbtAccessControlConditions,
  getGlobalLitHooks,
  litStorage,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';
import {
  buildDocLibraryCommonTags,
  buildDocLibraryPlaintextFileMetaTags,
  buildDocLibrarySbtTags,
  buildDocLibrarySessionTags,
  DOC_LIBRARY_DOC_ROLES,
  mergeTags,
  normalizeSbtAddress,
  normalizeSessionIdHex,
} from '../../utilities/docLibrary/tags.js';
import {
  resolveArweaveGraphqlUrl,
  resolveDocLibraryProvider,
} from '../../utilities/docLibrary/config.js';
import { listArweaveTransactionsByTags } from '../../utilities/docLibrary/arweaveGraphql.js';
import {
  resolveDocUploadsGate,
  uploadDocLibraryFile,
  uploadDocLibraryUrlRecord,
} from '../../utilities/docLibrary/uploads.js';
import SBTSelector from '../SBTs/SBTSelector.jsx';
import { toStr } from '../../utilities/shared/primitives.js';
import { notify } from '../../utilities/ui/notify.js';
import { createLogger } from '../../utilities/logging.js';

const log = createLogger('DocumentLibraryPanel');

type PanelMode = 'session' | 'sbt';
type SecondaryAssociationType = 'sbt' | 'session' | null;
type NetworkLike = { id?: number | string | null } | null;
type SessionConfig = Record<string, unknown> | null;

type TagEntry = {
  name: string;
  value: string;
};

type DocTagMap = Record<string, string>;

type DocData = {
  size: number | null;
  type: string | null;
};

type DocBlock = {
  height?: number | null;
  timestamp?: number | string | null;
};

type DocRecord = {
  cursor: string | null;
  txId: string;
  owner: string | null;
  tags: unknown[];
  tagMap: DocTagMap;
  block: DocBlock | null;
  data: DocData | null;
};

type CustomSbtEntry = {
  address: string;
  name?: string;
  chainId?: number | string | null;
  [key: string]: unknown;
};

type ListFilter = {
  name: string;
  values: string[];
};

type AutoOpenDoc = {
  txId: string;
  tagMap: DocTagMap;
};

type OpenableDoc = Pick<DocRecord, 'txId' | 'tagMap'>;

type DocUploadsGateState = {
  gate: unknown;
  lookupStatus: string;
  sbtAddresses: string[];
  chainId: number | string | null;
  mode: string;
  hasRecipients: boolean;
};

type LitHooks = {
  getKey?: (...args: unknown[]) => unknown;
  saveKey?: (...args: unknown[]) => Promise<unknown>;
} | null;

type EncryptAudience =
  | { ok: false; error: string }
  | { ok: true; encrypted: false }
  | {
      ok: true;
      encrypted: true;
      chainId: number | null;
      litChain: string;
      accessControlConditions: unknown;
      litHooks: {
        saveKey: (...args: unknown[]) => Promise<unknown>;
      };
    };

type FetchArweaveBlobResult =
  | { ok: true; blob: Blob; contentType: string }
  | { ok: false; error: string };

type UploadResult = {
  txId?: string;
  tagMap?: unknown;
  data?: Partial<DocData> | null;
};

type DocumentLibraryPanelProps = {
  provider?: unknown;
  network?: NetworkLike;
  account?: string | null;
  loginComplete?: boolean;
  toggleLoginModal?: (open?: boolean) => void;
  sessionSlug?: string;
  sessionConfig?: SessionConfig;
  mode?: PanelMode;
  sessionIdHex?: string;
  sbtChainId?: number | string | null;
  sbtAddress?: string;
  secondaryAssociationType?: SecondaryAssociationType;
  secondarySessionIdHex?: string;
  compact?: boolean;
  pageSize?: number;
};

const DEFAULT_DOC_UPLOADS_GATE: DocUploadsGateState = {
  gate: null,
  lookupStatus: '',
  sbtAddresses: [],
  chainId: null,
  mode: 'any',
  hasRecipients: false,
};

const buildSbtAccessControlConditionsUntyped = buildSbtAccessControlConditions as (args: {
  sbtAddresses: string[];
  chainId: number | null;
  litChain: string;
  mode: string;
}) => unknown;

const resolveLitChainUntyped = resolveLitChain as (args: {
  chainId: number | null;
}) => string;

const uploadDocLibraryFileUntyped = uploadDocLibraryFile as (args: {
  file: File;
  sessionSlug?: string;
  sessionConfig?: SessionConfig;
  account?: string | null;
  providerLike?: unknown;
  chainId?: number | string | null;
  tags: TagEntry[];
  encryption?: Record<string, unknown> | null;
}) => Promise<UploadResult>;

const uploadDocLibraryUrlRecordUntyped = uploadDocLibraryUrlRecord as (args: {
  url: string;
  title?: string;
  sessionSlug?: string;
  sessionConfig?: SessionConfig;
  account?: string | null;
  providerLike?: unknown;
  chainId?: number | string | null;
  tags: TagEntry[];
  encryption?: Record<string, unknown> | null;
}) => Promise<UploadResult>;

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

const normalizeDocTagMap = (value: unknown): DocTagMap => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toStr(entry)])
  );
};

const buildTagMapFromTags = (tags: TagEntry[]): DocTagMap => (
  Object.fromEntries(tags.map(({ name, value }) => [name, value]))
);

const buildPendingDocRecord = ({
  txId,
  tagMap,
  data,
}: {
  txId: string;
  tagMap?: unknown;
  data?: Partial<DocData> | null;
}): DocRecord => ({
  txId,
  cursor: null,
  owner: null,
  tags: [],
  tagMap: normalizeDocTagMap(tagMap),
  block: null,
  data: {
    size: data?.size ?? null,
    type: data?.type ?? null,
  },
});

const copyToClipboard = async (text: unknown): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(String(text || ''));
    notify.success('Copied to clipboard');
    return true;
  } catch (_) {
    return false;
  }
};

const sanitizeHttpUrl = (raw: unknown): string => {
  const value = toStr(raw).trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch (_) {
    return '';
  }
};

const isTextLikeMime = (mime: unknown): boolean => {
  const m = toStr(mime).trim().toLowerCase();
  if (!m) return false;
  if (m.startsWith('text/')) return true;
  return [
    'application/json',
    'application/xml',
    'application/xhtml+xml',
    'application/javascript',
    'application/x-javascript',
    'image/svg+xml',
  ].includes(m);
};

const safeFilename = (name: unknown, fallback = 'document'): string => {
  const raw = toStr(name).trim();
  if (!raw) return fallback;
  return raw.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 180) || fallback;
};

const isArweaveTxId = (value: unknown): boolean => /^[a-z0-9_-]{43}$/i.test(toStr(value).trim());

const buildSessionListFilters = (sessionIdHex: string): ListFilter[] => ([
  { name: 'CE-DocLibrary', values: ['1'] },
  { name: 'CE-SessionId', values: [normalizeSessionIdHex(sessionIdHex)] },
].filter((f) => f.values && f.values[0]));

const buildSbtListFilters = ({ chainId, sbtAddress }: { chainId?: number | string | null; sbtAddress?: string }): ListFilter[] => ([
  { name: 'CE-DocLibrary', values: ['1'] },
  { name: 'CE-SbtChainId', values: [String(Number(chainId || 0) || '')] },
  { name: 'CE-SbtAddress', values: [normalizeSbtAddress(sbtAddress)] },
].filter((f) => f.values && f.values[0]));

const fetchArweaveBlobWithFallback = async (
  txId: string,
  opts: { gateways?: string[] } = {},
): Promise<FetchArweaveBlobResult> => {
  const gateways = Array.isArray(opts.gateways) && opts.gateways.length
      ? opts.gateways
      : DOC_LIBRARY_ARWEAVE_GATEWAYS;

  let lastErr: unknown = null;
  for (const gw of gateways) {
    const url = arweaveScripts.buildArweaveGatewayUrl(txId, gw);
    try {
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        lastErr = new Error(`Arweave fetch failed (${resp.status})`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const blob = await resp.blob();
      const ct = resp.headers.get('content-type') || blob.type || '';
      return { ok: true, blob, contentType: ct };
    } catch (err) {
      lastErr = err;
    }
  }
  return { ok: false, error: getErrorMessage(lastErr, 'Arweave fetch failed.') };
};

export default function DocumentLibraryPanel({
  provider,
  network,
  account,
  loginComplete,
  toggleLoginModal,
  sessionSlug,
  sessionConfig,
  mode = 'session', // "session" | "sbt"
  sessionIdHex,
  sbtChainId,
  sbtAddress,
  secondaryAssociationType = null, // "sbt" | "session" | null
  secondarySessionIdHex,
  compact = false,
  pageSize = 25,
}: DocumentLibraryPanelProps = {}) {
  const normalizedSessionIdHex = useMemo(() => normalizeSessionIdHex(sessionIdHex), [sessionIdHex]);
  const normalizedSbtAddress = useMemo(() => normalizeSbtAddress(sbtAddress), [sbtAddress]);
  const normalizedSecondarySessionIdHex = useMemo(
    () => normalizeSessionIdHex(secondarySessionIdHex),
    [secondarySessionIdHex],
  );
  const resolvedSbtChainId = useMemo(
    () => (Number(sbtChainId || network?.id || 0) || null),
    [sbtChainId, network?.id],
  );

  const panelContextKey = useMemo(() => {
    const slug = toStr(sessionSlug).trim().toLowerCase();
    if (mode === 'session') {
      const id = slug || normalizedSessionIdHex;
      return id ? `session:${id}` : '';
    }
    if (mode === 'sbt') {
      const chain = resolvedSbtChainId ? String(resolvedSbtChainId) : '';
      const addr = normalizedSbtAddress || '';
      const id = `${chain}:${addr}:${slug}`;
      return (chain && addr) ? `sbt:${id}` : '';
    }
    return '';
  }, [mode, sessionSlug, normalizedSessionIdHex, resolvedSbtChainId, normalizedSbtAddress]);

  const docProvider = useMemo(() => toStr(resolveDocLibraryProvider(sessionConfig)).trim().toLowerCase(), [sessionConfig]);
  const graphqlUrl = useMemo(
    () => toStr(resolveArweaveGraphqlUrl(sessionConfig)).trim(),
    [sessionConfig],
  );

  const docUploadsGate = useMemo<DocUploadsGateState>(() => {
    const resolved = (resolveDocUploadsGate(sessionConfig) as Partial<DocUploadsGateState> | null) || null;
    return {
      gate: resolved?.gate ?? null,
      lookupStatus: toStr(resolved?.lookupStatus).trim(),
      sbtAddresses: Array.isArray(resolved?.sbtAddresses)
        ? resolved.sbtAddresses.map((value) => toStr(value).trim()).filter(Boolean)
        : [],
      chainId: resolved?.chainId ?? null,
      mode: toStr(resolved?.mode || 'any').trim() || 'any',
      hasRecipients: Boolean(resolved?.hasRecipients),
    };
  }, [sessionConfig]);

  const locationSearch = typeof window !== 'undefined' ? (window.location.search || '') : '';

  const autoOpenDoc = useMemo<AutoOpenDoc | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const qp = new URLSearchParams(locationSearch);
      const txId = toStr(qp.get('__ceDocTx') || '').trim();
      if (!isArweaveTxId(txId)) return null;

      const storage = toStr(qp.get('__ceDocStorage') || '').trim() || 'lit-arweave';
      const kind = toStr(qp.get('__ceDocKind') || '').trim() || 'file';
      const name = toStr(qp.get('__ceDocName') || '').trim();

      const tagMap = {
        'CE-DocStorage': storage,
        'CE-DocKind': kind,
        ...(name ? { 'CE-DocName': name } : {}),
      };

      return { txId, tagMap };
    } catch (_) {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationSearch]);

  const [docs, setDocs] = useState<DocRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Prevent in-flight list requests from overwriting state after context/query changes.
  // We "cancel" by bumping a request sequence and checking it before applying results.
  const listRequestSeqRef = useRef(0);
  const activeListQueryKeyRef = useRef('');
  const loadingRef = useRef(false);
  const cursorRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');

  // Track whether the user has manually changed encryption defaults; if they have,
  // don't auto-reset when gates/config load asynchronously.
  const userEncryptionOverrideRef = useRef(false);
  const lastContextKeyRef = useRef('');
  const [locked, setLocked] = useState(false);
  const [audienceMode, setAudienceMode] = useState('custom'); // "sessionGate" | "custom"
  const [customSbtList, setCustomSbtList] = useState<CustomSbtEntry[]>([]);
  const [customGateMode, setCustomGateMode] = useState('any'); // any|all

  const [alsoAssociateSbt, setAlsoAssociateSbt] = useState(false);
  const [assocSbtChainId, setAssocSbtChainId] = useState<number | string>(Number(sbtChainId || network?.id || 0) || '');
  const [assocSbtAddress, setAssocSbtAddress] = useState('');

  const [alsoAssociateSession, setAlsoAssociateSession] = useState(false);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerText, setViewerText] = useState('');
  const [viewerBlobUrl, setViewerBlobUrl] = useState('');
  const [viewerMime, setViewerMime] = useState('');

  const autoOpenedRef = useRef('');

  useEffect(() => {
    return () => {
      if (!viewerBlobUrl) return;
      if (typeof URL === 'undefined') return;
      try { URL.revokeObjectURL(viewerBlobUrl); } catch (e) { log.warn('DocumentLibraryPanel: cleanup', e); }
    };
  }, [viewerBlobUrl]);

  useEffect(() => {
    if (!panelContextKey) return;
    if (lastContextKeyRef.current === panelContextKey) return;
    lastContextKeyRef.current = panelContextKey;

    // Reset per-context encryption overrides so each session/group starts from defaults.
    userEncryptionOverrideRef.current = false;

    // Prevent accidental re-use of a prior group's custom audience list when the
    // panel is reused across navigation.
    if (mode === 'sbt') {
      setCustomSbtList(normalizedSbtAddress ? [{ address: normalizedSbtAddress }] : []);
    } else {
      setCustomSbtList([]);
    }
  }, [panelContextKey, mode, normalizedSbtAddress]);

  useEffect(() => {
    const shouldLock = !!docUploadsGate.hasRecipients;
    if (userEncryptionOverrideRef.current) return;
    setLocked(shouldLock);
    setAudienceMode(shouldLock ? 'sessionGate' : 'custom');
  }, [docUploadsGate.hasRecipients, panelContextKey]);

  useEffect(() => {
    if (mode !== 'sbt' || !normalizedSbtAddress) return;
    setCustomSbtList((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.length) return list;
      return [{ address: normalizedSbtAddress }];
    });
  }, [mode, normalizedSbtAddress]);

  const toggleLocked = useCallback(() => {
    userEncryptionOverrideRef.current = true;
    setLocked((v) => !v);
  }, []);

  const listFilters = useMemo(() => {
    if (docProvider !== 'arweave') return [];
    if (mode === 'session') return buildSessionListFilters(normalizedSessionIdHex);
    if (mode === 'sbt') {
      return buildSbtListFilters({ chainId: sbtChainId || network?.id || null, sbtAddress: normalizedSbtAddress });
    }
    return [];
  }, [docProvider, mode, normalizedSessionIdHex, normalizedSbtAddress, network?.id, sbtChainId]);

  const listQueryKey = useMemo(() => (
    JSON.stringify({
      provider: docProvider,
      graphqlUrl,
      listFilters,
    })
  ), [docProvider, graphqlUrl, listFilters]);

  const canList = useMemo(() => {
    if (docProvider !== 'arweave') return false;
    if (mode === 'session') return !!normalizedSessionIdHex;
    if (mode === 'sbt') return !!normalizedSbtAddress && !!Number(sbtChainId || network?.id || 0);
    return false;
  }, [docProvider, mode, normalizedSessionIdHex, normalizedSbtAddress, network?.id, sbtChainId]);

  const loadDocs = useCallback(async ({ reset }: { reset?: boolean } = {}) => {
    if (!canList) return;
    if (loadingRef.current && !reset) return;
    if (!reset && !cursorRef.current) return;
    setError('');
    const requestSeq = (listRequestSeqRef.current += 1);
    const expectedQueryKey = listQueryKey;
    loadingRef.current = true;
    setLoading(true);
    try {
      const after = reset ? null : cursorRef.current;
      const edges = (await listArweaveTransactionsByTags({
        graphqlUrl,
        tags: listFilters,
        first: pageSize,
        after,
      })) as DocRecord[];

      if (listRequestSeqRef.current !== requestSeq || activeListQueryKeyRef.current !== expectedQueryKey) return;

      setDocs((prev) => {
        const base = reset ? [] : (Array.isArray(prev) ? prev : []);
        const next = [...base];
        const idxById = new Map();
        next.forEach((doc, idx) => {
          const id = toStr(doc?.txId).trim();
          if (id) idxById.set(id, idx);
        });
        edges.forEach((edge) => {
          const id = toStr(edge?.txId).trim();
          if (!id) return;
          const existingIdx = idxById.get(id);
          if (existingIdx == null) {
            idxById.set(id, next.length);
            next.push(edge);
            return;
          }
          const prevDoc = next[existingIdx] || {};
          next[existingIdx] = {
            ...prevDoc,
            ...edge,
            tags: Array.isArray(edge.tags) ? edge.tags : (Array.isArray(prevDoc.tags) ? prevDoc.tags : []),
            tagMap: edge.tagMap && typeof edge.tagMap === 'object'
              ? normalizeDocTagMap(edge.tagMap)
              : (prevDoc.tagMap && typeof prevDoc.tagMap === 'object' ? prevDoc.tagMap : {}),
          };
        });
        return next;
      });
      const nextCursor = edges.length ? edges[edges.length - 1].cursor : null;
      cursorRef.current = nextCursor;
      setCursor(nextCursor);
    } catch (err) {
      if (listRequestSeqRef.current !== requestSeq || activeListQueryKeyRef.current !== expectedQueryKey) return;
      setError(getErrorMessage(err, 'Failed to load docs.'));
    } finally {
      if (listRequestSeqRef.current !== requestSeq || activeListQueryKeyRef.current !== expectedQueryKey) return;
      loadingRef.current = false;
      setLoading(false);
    }
  }, [canList, graphqlUrl, listFilters, pageSize, listQueryKey]);

  useEffect(() => {
    activeListQueryKeyRef.current = listQueryKey;
    // Cancel in-flight requests for the previous query to avoid stale updates.
    listRequestSeqRef.current += 1;
    loadingRef.current = false;
    cursorRef.current = null;
    setError('');
    setLoading(false);
    setDocs([]);
    setCursor(null);
    if (!canList) return;
    loadDocs({ reset: true });
  }, [canList, listQueryKey, loadDocs]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setViewerLoading(false);
    setViewerError('');
    setViewerTitle('');
    setViewerText('');
    setViewerBlobUrl('');
    setViewerMime('');
  }, []);

  const openDoc = useCallback(async (doc: OpenableDoc) => {
    const txId = toStr(doc?.txId).trim();
    if (!txId) return;

    const tagMap = doc?.tagMap || {};
    const storage = toStr(tagMap['CE-DocStorage']).trim().toLowerCase();
    const kind = toStr(tagMap['CE-DocKind']).trim().toLowerCase();
    const isEncrypted = storage === 'lit-arweave' || storage === 'lit';

    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError('');
    setViewerText('');
    setViewerMime('');
    setViewerBlobUrl('');
    setViewerTitle(isEncrypted ? 'Decrypting…' : 'Loading…');

    try {
      if (isEncrypted) {
        const litHooks = getGlobalLitHooks() as LitHooks;
        if (!litHooks || typeof litHooks.getKey !== 'function') {
          throw new Error('Connect a wallet to decrypt this document.');
        }
        const { payload } = await litStorage.downloadEncryptedArweaveData({
          url: litStorage.buildLitArweaveUrl(txId),
          providerLike: provider,
          account,
          chainId: network?.id || null,
          lit: { getKey: litHooks.getKey },
          arweave: {
            debugContext: {
              category: 'doc_lit_payload',
              caller: 'DocumentLibraryPanel.openDoc.encrypted',
              slug: panelContextKey || '',
              chainId: Number(network?.id || 0) || null,
            },
          },
        });

        const name = toStr(payload?.name || '').trim() || (kind === 'link' ? 'Encrypted link' : 'Encrypted document');
        const mime = toStr(payload?.mime || '').trim();
        const text = litStorage.decodeLitPayloadToText(payload);
        if (text) {
          setViewerTitle(name);
          setViewerMime(mime || 'text/plain');
          setViewerText(text);
          setViewerLoading(false);
          return;
        }
        const blob = litStorage.decodeLitPayloadToBlob(payload);
        if (!blob) {
          throw new Error('Unable to decode encrypted document.');
        }
        const blobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
        setViewerTitle(name);
        setViewerMime(blob.type || mime || '');
        setViewerBlobUrl(blobUrl);
        setViewerLoading(false);
        return;
      }

      if (kind === 'link') {
        const text = await arweaveScripts.downloadDataFromArweave(txId, {
          debugContext: {
            category: 'doc_link_payload',
            caller: 'DocumentLibraryPanel.openDoc.link',
            slug: panelContextKey || '',
            chainId: Number(network?.id || 0) || null,
          },
        });
        setViewerTitle(toStr(tagMap['CE-DocName']).trim() || 'Link record');
        setViewerMime('application/json');
        setViewerText(text || '');
        setViewerLoading(false);
        return;
      }

      const res = await fetchArweaveBlobWithFallback(txId);
      if (!res.ok) throw new Error(res.error || 'Failed to fetch document.');
      const blob = res.blob;
      const mime = toStr(res.contentType || blob.type || '').trim();
      if (isTextLikeMime(mime)) {
        const text = await blob.text();
        setViewerTitle(toStr(tagMap['CE-DocName']).trim() || 'Document');
        setViewerMime(mime || 'text/plain');
        setViewerText(text || '');
        setViewerLoading(false);
        return;
      }
      const blobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
      setViewerTitle(toStr(tagMap['CE-DocName']).trim() || 'Document');
      setViewerMime(mime);
      setViewerBlobUrl(blobUrl);
      setViewerLoading(false);
    } catch (err) {
      setViewerLoading(false);
      setViewerError(getErrorMessage(err, 'Failed to open document.'));
      setViewerTitle('Error');
    }
  }, [provider, account, network?.id, panelContextKey]);

  useEffect(() => {
    if (!autoOpenDoc || !autoOpenDoc.txId) return;

    const key = `${panelContextKey}:${autoOpenDoc.txId}`;
    if (autoOpenedRef.current === key) return;

    const storage = toStr(autoOpenDoc.tagMap?.['CE-DocStorage']).trim().toLowerCase();
    const wantsEncrypted = storage === 'lit-arweave' || storage === 'lit';
    if (wantsEncrypted && (!loginComplete || !toStr(account).trim() || !provider)) return;
    if (wantsEncrypted) {
      const litHooks = getGlobalLitHooks() as LitHooks;
      if (!litHooks || typeof litHooks.getKey !== 'function') return;
    }

    autoOpenedRef.current = key;
    openDoc({ txId: autoOpenDoc.txId, tagMap: autoOpenDoc.tagMap });

    // Clear params so refresh/back doesn't re-open repeatedly.
    try {
      const url = new URL(window.location.href);
      ['__ceDocTx', '__ceDocStorage', '__ceDocKind', '__ceDocName'].forEach((param) => {
        url.searchParams.delete(param);
      });
      window.history.replaceState({}, '', url.toString());
    } catch (e) { log.warn('DocumentLibraryPanel: fallback', e); }
  }, [autoOpenDoc, panelContextKey, loginComplete, provider, account, openDoc]);

  const addCustomSbt = useCallback((sbt: CustomSbtEntry) => {
    const addr = normalizeSbtAddress(sbt?.address);
    if (!addr) return;
    setCustomSbtList((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.some((entry) => (entry?.address || '').toLowerCase() === addr)) return list;
      return [
        ...list,
        {
          ...sbt,
          address: addr,
        },
      ];
    });
  }, []);

  const removeCustomSbt = useCallback((addr: string) => {
    const target = normalizeSbtAddress(addr);
    if (!target) return;
    setCustomSbtList((prev) => (Array.isArray(prev) ? prev.filter((e) => (e?.address || '').toLowerCase() !== target) : []));
  }, []);

  const resolveAssociationTags = useCallback(({
    kind,
    storage,
    plaintextMeta,
  }: {
    kind?: string;
    storage?: string;
    plaintextMeta?: TagEntry[];
  } = {}): TagEntry[] => {
    const common = buildDocLibraryCommonTags({ kind, storage });

    const primarySession = (mode === 'session')
      ? buildDocLibrarySessionTags({ sessionIdHex: normalizedSessionIdHex })
      : [];
    const primarySbt = (mode === 'sbt')
      ? buildDocLibrarySbtTags({ chainId: sbtChainId || network?.id || null, sbtAddress: normalizedSbtAddress })
      : [];

    const secondarySbt = (secondaryAssociationType === 'sbt' && alsoAssociateSbt)
      ? buildDocLibrarySbtTags({ chainId: assocSbtChainId, sbtAddress: assocSbtAddress })
      : [];
    const secondarySession = (secondaryAssociationType === 'session' && alsoAssociateSession && normalizedSecondarySessionIdHex)
      ? buildDocLibrarySessionTags({ sessionIdHex: normalizedSecondarySessionIdHex })
      : [];

    return mergeTags(common, primarySession, primarySbt, secondarySbt, secondarySession, plaintextMeta) as TagEntry[];
  }, [
    mode,
    normalizedSessionIdHex,
    sbtChainId,
    network?.id,
    normalizedSbtAddress,
    secondaryAssociationType,
    alsoAssociateSbt,
    assocSbtChainId,
    assocSbtAddress,
    alsoAssociateSession,
    normalizedSecondarySessionIdHex,
  ]);

  const resolveEncryptAudience = useCallback((): EncryptAudience => {
    if (!locked) return { ok: true, encrypted: false };
    const litHooks = getGlobalLitHooks() as LitHooks;
    const saveKey = litHooks?.saveKey;
    if (!litHooks || typeof saveKey !== 'function') {
      return { ok: false, error: 'Lit hooks not initialized; connect a wallet to encrypt.' };
    }

    if (audienceMode === 'sessionGate') {
      if (!docUploadsGate.hasRecipients) {
        return { ok: false, error: 'Session docUploads gate is unavailable or empty.' };
      }
      const chainId = Number(docUploadsGate.chainId || network?.id || 0) || null;
      const litChain = resolveLitChainUntyped({ chainId });
      const acc = buildSbtAccessControlConditionsUntyped({
        sbtAddresses: docUploadsGate.sbtAddresses,
        chainId,
        litChain,
        mode: docUploadsGate.mode || 'any',
      });
      if (!acc) return { ok: false, error: 'Session docUploads gate has no valid SBT addresses.' };
      return { ok: true, encrypted: true, chainId, litChain, accessControlConditions: acc, litHooks: { saveKey } };
    }

    const list = (customSbtList || []).map((e) => e.address).filter(Boolean);
    const chainId = Number(sbtChainId || docUploadsGate.chainId || network?.id || 0) || null;
    const litChain = resolveLitChainUntyped({ chainId });
    const acc = buildSbtAccessControlConditionsUntyped({
      sbtAddresses: list,
      chainId,
      litChain,
      mode: customGateMode || 'any',
    });
    if (!acc) return { ok: false, error: 'Add at least one SBT address to encrypt.' };
    return { ok: true, encrypted: true, chainId, litChain, accessControlConditions: acc, litHooks: { saveKey } };
  }, [
    locked,
    audienceMode,
    docUploadsGate.hasRecipients,
    docUploadsGate.chainId,
    docUploadsGate.mode,
    docUploadsGate.sbtAddresses,
    network?.id,
    customSbtList,
    customGateMode,
    sbtChainId,
  ]);

  const uploadFile = useCallback(async () => {
    if (docProvider !== 'arweave') return;
    if (!file) return;
    if (!loginComplete && typeof toggleLoginModal === 'function') {
      toggleLoginModal(true);
      return;
    }

    setError('');
    const storage = locked ? 'lit-arweave' : 'arweave';
    const plaintextMeta = locked
      ? []
      : buildDocLibraryPlaintextFileMetaTags({ name: file.name, mime: file.type, size: file.size });
    const tags = resolveAssociationTags({ kind: 'file', storage, plaintextMeta });

    // Session doc library requires sessionIdHex to index; do not silently upload unindexed docs.
    if (mode === 'session' && !normalizedSessionIdHex) {
      setError('Session ID is unavailable; cannot upload session docs.');
      return;
    }
    if (mode === 'sbt' && (!normalizedSbtAddress || !Number(sbtChainId || network?.id || 0))) {
      setError('SBT association is missing; cannot upload group docs.');
      return;
    }

    try {
      if (!locked) {
        const result = await uploadDocLibraryFileUntyped({
          file,
          sessionSlug,
          sessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags,
        });
        const txId = toStr(result?.txId).trim();
        if (txId) {
          setDocs((prev) => [
            buildPendingDocRecord({
              txId,
              tagMap: result.tagMap || buildTagMapFromTags(tags),
              data: result.data || { size: file.size || null, type: file.type || null },
            }),
            ...prev,
          ]);
        }
        setFile(null);
        return;
      }

      const audience = resolveEncryptAudience();
      if (!audience.ok || !audience.encrypted) {
        throw new Error(audience.ok ? 'Encryption audience unavailable.' : audience.error || 'Encryption audience unavailable.');
      }

      const result = await uploadDocLibraryFileUntyped({
        file,
        sessionSlug,
        sessionConfig,
        account,
        providerLike: provider,
        chainId: network?.id || null,
        tags,
        encryption: {
          enabled: true,
          saveKey: audience.litHooks.saveKey,
          accessControlConditions: audience.accessControlConditions,
          litChain: audience.litChain,
          chainId: audience.chainId,
          contextLabel: `doc:${sessionSlug || ''}`,
        },
      });

      const txId = toStr(result?.txId).trim();
      if (txId) {
        setDocs((prev) => [
          buildPendingDocRecord({
            txId,
            tagMap: result.tagMap || buildTagMapFromTags(tags),
            data: result.data || { size: null, type: 'application/json' },
          }),
          ...prev,
        ]);
      }
      setFile(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed.'));
    }
  }, [
    docProvider,
    file,
    loginComplete,
    toggleLoginModal,
    locked,
    provider,
    account,
    network?.id,
    sessionSlug,
    sessionConfig,
    resolveAssociationTags,
    resolveEncryptAudience,
    mode,
    normalizedSessionIdHex,
    normalizedSbtAddress,
    sbtChainId,
  ]);

  const uploadUrlRecord = useCallback(async () => {
    if (docProvider !== 'arweave') return;
    const url = toStr(urlInput).trim();
    if (!url) return;
    if (!loginComplete && typeof toggleLoginModal === 'function') {
      toggleLoginModal(true);
      return;
    }

    setError('');
    let parsed;
    try {
      parsed = new URL(url);
    } catch (_) {
      setError('Invalid URL.');
      return;
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      setError('URL must be http(s).');
      return;
    }

    const record = {
      v: 1,
      kind: 'link',
      url: parsed.toString(),
      title: toStr(urlTitle).trim() || null,
      createdAt: new Date().toISOString(),
    };

    const storage = locked ? 'lit-arweave' : 'arweave';
    const plaintextMeta = locked
      ? []
      : buildDocLibraryPlaintextFileMetaTags({ name: record.title || record.url, mime: 'application/json', size: '' });
    const tags = resolveAssociationTags({ kind: 'link', storage, plaintextMeta });

    if (mode === 'session' && !normalizedSessionIdHex) {
      setError('Session ID is unavailable; cannot upload session docs.');
      return;
    }
    if (mode === 'sbt' && (!normalizedSbtAddress || !Number(sbtChainId || network?.id || 0))) {
      setError('SBT association is missing; cannot upload group docs.');
      return;
    }

    try {
      if (!locked) {
        const result = await uploadDocLibraryUrlRecordUntyped({
          url,
          title: urlTitle,
          sessionSlug,
          sessionConfig,
          account,
          providerLike: provider,
          chainId: network?.id || null,
          tags,
        });
        const txId = toStr(result?.txId).trim();
        if (txId) {
          setDocs((prev) => [
            buildPendingDocRecord({
              txId,
              tagMap: result.tagMap || buildTagMapFromTags(tags),
              data: result.data || { size: null, type: 'application/json' },
            }),
            ...prev,
          ]);
        }
        setUrlInput('');
        setUrlTitle('');
        return;
      }

      const audience = resolveEncryptAudience();
      if (!audience.ok || !audience.encrypted) {
        throw new Error(audience.ok ? 'Encryption audience unavailable.' : audience.error || 'Encryption audience unavailable.');
      }

      const result = await uploadDocLibraryUrlRecordUntyped({
        url,
        title: urlTitle,
        sessionSlug,
        sessionConfig,
        account,
        providerLike: provider,
        chainId: network?.id || null,
        tags,
        encryption: {
          enabled: true,
          saveKey: audience.litHooks.saveKey,
          accessControlConditions: audience.accessControlConditions,
          litChain: audience.litChain,
          chainId: audience.chainId,
          contextLabel: `doc-link:${sessionSlug || ''}`,
        },
      });

      const txId = toStr(result?.txId).trim();
      if (txId) {
        setDocs((prev) => [
          buildPendingDocRecord({
            txId,
            tagMap: result.tagMap || buildTagMapFromTags(tags),
            data: result.data || { size: null, type: 'application/json' },
          }),
          ...prev,
        ]);
      }
      setUrlInput('');
      setUrlTitle('');
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed.'));
    }
  }, [
    docProvider,
    urlInput,
    urlTitle,
    loginComplete,
    toggleLoginModal,
    locked,
    provider,
    account,
    network?.id,
    sessionSlug,
    sessionConfig,
    resolveAssociationTags,
    resolveEncryptAudience,
    mode,
    normalizedSessionIdHex,
    normalizedSbtAddress,
    sbtChainId,
  ]);

  const renderViewerBody = () => {
    if (viewerError) {
      return <div className={styles.viewerError} data-testid={E2E_TESTIDS.DOC_VIEWER_ERROR}>{viewerError}</div>;
    }
    if (viewerLoading) {
      return (
        <div className={styles.viewerLoading}>
          <FontAwesomeIcon icon={faSpinner} spin /> Loading…
        </div>
      );
    }

    if (viewerText) {
      const mime = toStr(viewerMime).trim().toLowerCase();
      if (mime === 'application/json') {
        try {
          const parsed = JSON.parse(viewerText);
          if (parsed && parsed.kind === 'link' && parsed.url) {
            const safeUrl = sanitizeHttpUrl(parsed.url);
            return (
              <div className={styles.viewerLink}>
                <div className={styles.viewerLinkTitle}>{toStr(parsed.title).trim() || 'Link'}</div>
                {safeUrl ? (
                  <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                    {safeUrl}
                  </a>
                ) : (
                  <div className={styles.noticeInline}>
                    Unsafe or invalid URL (not rendered as a link): <code>{toStr(parsed.url).trim()}</code>
                  </div>
                )}
                <pre className={styles.viewerPre} data-testid={E2E_TESTIDS.DOC_VIEWER_TEXT}>{viewerText}</pre>
              </div>
            );
          }
        } catch (e) { log.warn('DocumentLibraryPanel: fallback', e); }
      }
      return <pre className={styles.viewerPre} data-testid={E2E_TESTIDS.DOC_VIEWER_TEXT}>{viewerText}</pre>;
    }

    if (viewerBlobUrl) {
      const mime = toStr(viewerMime).trim().toLowerCase();
      const filename = safeFilename(viewerTitle, 'document');

      if (mime.startsWith('image/')) {
        return (
          <div className={styles.viewerMedia}>
            <img src={viewerBlobUrl} alt={filename} className={styles.viewerImage} data-testid={E2E_TESTIDS.DOC_VIEWER_IMAGE} />
            <a href={viewerBlobUrl} download={filename} className={styles.viewerDownload} data-testid={E2E_TESTIDS.DOC_VIEWER_DOWNLOAD}>
              Download file
            </a>
          </div>
        );
      }
      if (mime === 'application/pdf') {
        return (
          <div className={styles.viewerMedia}>
            <iframe title="PDF" src={viewerBlobUrl} className={styles.viewerPdf} data-testid={E2E_TESTIDS.DOC_VIEWER_PDF} />
            <a href={viewerBlobUrl} download={filename} className={styles.viewerDownload} data-testid={E2E_TESTIDS.DOC_VIEWER_DOWNLOAD}>
              Download file
            </a>
          </div>
        );
      }
      if (mime.startsWith('audio/')) {
        return (
          <div className={styles.viewerMedia}>
            <audio controls src={viewerBlobUrl} className={styles.viewerAudio} />
            <a href={viewerBlobUrl} download={filename} className={styles.viewerDownload} data-testid={E2E_TESTIDS.DOC_VIEWER_DOWNLOAD}>
              Download file
            </a>
          </div>
        );
      }
      if (mime.startsWith('video/')) {
        return (
          <div className={styles.viewerMedia}>
            <video controls src={viewerBlobUrl} className={styles.viewerVideo} />
            <a href={viewerBlobUrl} download={filename} className={styles.viewerDownload} data-testid={E2E_TESTIDS.DOC_VIEWER_DOWNLOAD}>
              Download file
            </a>
          </div>
        );
      }
      return (
        <div className={styles.viewerMedia}>
          <a href={viewerBlobUrl} download={filename} className={styles.viewerDownload} data-testid={E2E_TESTIDS.DOC_VIEWER_DOWNLOAD}>
            Download file
          </a>
        </div>
      );
    }

    return <div className={styles.viewerEmpty}>No preview available.</div>;
  };

  return (
    <div
      className={compact ? `${styles.panel} ${styles.compact}` : styles.panel}
      data-testid={E2E_TESTIDS.DOC_PANEL}
    >
      <div className={styles.header}>
        <div className={styles.title} data-testid={E2E_TESTIDS.DOC_TITLE}>Doc Library</div>
        <div className={styles.headerActions}>
          <Button
            type="button"
            color="secondary"
            outline
            size="sm"
            className={styles.actionBtn}
            onClick={() => loadDocs({ reset: true })}
            disabled={!canList || loading}
            title="Refresh"
            data-testid={E2E_TESTIDS.DOC_REFRESH}
          >
            <FontAwesomeIcon icon={faSync} />
          </Button>
        </div>
      </div>

      {docProvider !== 'arweave' && (
        <div className={styles.notice}>
          Doc library provider <code>{docProvider}</code> is not implemented yet for listing/upload.
        </div>
      )}

      {docProvider === 'arweave' && mode === 'session' && !normalizedSessionIdHex && (
        <div className={styles.notice}>
          Session ID is unavailable for this session. Session docs are indexed by <code>sessionIdHex</code>, so listing/upload is disabled.
        </div>
      )}

      {docProvider === 'arweave' && mode === 'sbt' && (!normalizedSbtAddress || !Number(sbtChainId || network?.id || 0)) && (
        <div className={styles.notice}>
          Missing SBT association (chainId + address). Group docs listing/upload is disabled.
        </div>
      )}

      {!!error && <div className={styles.error}>{error}</div>}

      <div className={styles.uploadBox}>
        <div className={styles.uploadRow}>
          <div className={styles.uploadLabel}>File</div>
          <input
            type="file"
            className={styles.fileInput}
            data-testid={E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT}
            onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
          />
          <Button
            type="button"
            color="primary"
            size="sm"
            className={styles.primaryBtn}
            onClick={uploadFile}
            disabled={!file || docProvider !== 'arweave'}
            data-testid={E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON}
          >
            <FontAwesomeIcon icon={faUpload} /> Upload
          </Button>
        </div>

        <div className={styles.uploadRow}>
          <div className={styles.uploadLabel}>
            URL
          </div>
          <Input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Add URL (stored as a link record, not fetched)"
            className={styles.urlField}
            data-testid={E2E_TESTIDS.DOC_URL_INPUT}
          />
          <Button
            type="button"
            color="primary"
            size="sm"
            className={styles.primaryBtn}
            onClick={uploadUrlRecord}
            disabled={!toStr(urlInput).trim() || docProvider !== 'arweave'}
            title="Upload link record"
            data-testid={E2E_TESTIDS.DOC_URL_ADD_BUTTON}
          >
            <FontAwesomeIcon icon={faLink} /> Add
          </Button>
        </div>

        <div className={styles.uploadRow}>
          <div className={styles.uploadLabel} />
          <Input
            type="text"
            value={urlTitle}
            onChange={(e) => setUrlTitle(e.target.value)}
            placeholder="Optional title"
            className={styles.urlField}
            data-testid={E2E_TESTIDS.DOC_URL_TITLE_INPUT}
          />
        </div>

        <div className={styles.encryptBox}>
          <div className={styles.encryptHeader}>
            <button
              type="button"
              className={styles.lockToggle}
              onClick={toggleLocked}
              title={locked ? 'Upload plaintext' : 'Encrypt with Lit'}
              data-testid={E2E_TESTIDS.DOC_LOCK_TOGGLE}
              data-ce-locked={locked ? 'true' : 'false'}
            >
              <FontAwesomeIcon icon={locked ? faLock : faLockOpen} />
              <span className={styles.lockLabel}>{locked ? 'Locked (Encrypted)' : 'Unlocked (Plaintext)'}</span>
            </button>
          </div>

          {locked && (
            <div className={styles.encryptControls}>
              <div className={styles.audienceRow}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="audienceMode"
                    checked={audienceMode === 'sessionGate'}
                    onChange={() => {
                      userEncryptionOverrideRef.current = true;
                      setAudienceMode('sessionGate');
                    }}
                    disabled={!docUploadsGate.hasRecipients}
                    data-testid={E2E_TESTIDS.DOC_AUDIENCE_SESSION_GATE}
                  />
                  Session <code>docUploads</code> gate
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="audienceMode"
                    checked={audienceMode === 'custom'}
                    onChange={() => {
                      userEncryptionOverrideRef.current = true;
                      setAudienceMode('custom');
                    }}
                    data-testid={E2E_TESTIDS.DOC_AUDIENCE_CUSTOM}
                  />
                  Custom SBT(s)
                </label>
              </div>

              {audienceMode === 'sessionGate' && (
                <div className={styles.gateSummary}>
                  {docUploadsGate.hasRecipients ? (
                    <div>
                      <div><strong>Mode:</strong> {docUploadsGate.mode}</div>
                      <div><strong>SBTs:</strong> {docUploadsGate.sbtAddresses.length}</div>
                    </div>
                  ) : (
                    <div className={styles.noticeInline}>
                      Session <code>docUploads</code> gate is unavailable or empty. Uploads will default to plaintext unless you pick Custom SBT(s).
                    </div>
                  )}
                </div>
              )}

              {audienceMode === 'custom' && (
                <div className={styles.customAudience}>
                  <div
                    className={styles.customSelectorWrap}
                    data-testid={E2E_TESTIDS.DOC_CUSTOM_SBT_SELECTOR}
                  >
                    <SBTSelector
                      id={`doc-library-custom-${mode || 'session'}`}
                      label="Select SBT access"
                      selectedSBTs={customSbtList}
                      onAddSBT={addCustomSbt}
                      onRemoveSBT={removeCustomSbt}
                      network={network}
                      sessionSlug={sessionSlug || ''}
                      discoverySessionSlugs={[sessionSlug || '']}
                      variant="create"
                    />
                  </div>

                  <div className={styles.customRow}>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="customGateMode"
                        checked={customGateMode === 'any'}
                        onChange={() => setCustomGateMode('any')}
                        data-testid={E2E_TESTIDS.DOC_CUSTOM_MODE_ANY}
                      />
                      Any
                    </label>
                    <label className={styles.radioLabel}>
                      <input
                        type="radio"
                        name="customGateMode"
                        checked={customGateMode === 'all'}
                        onChange={() => setCustomGateMode('all')}
                        data-testid={E2E_TESTIDS.DOC_CUSTOM_MODE_ALL}
                      />
                      All
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {secondaryAssociationType === 'sbt' && mode !== 'session' && (
          <div className={styles.secondaryAssoc}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={alsoAssociateSbt} onChange={(e) => setAlsoAssociateSbt(e.target.checked)} />
              Also associate with SBT group
            </label>
            {alsoAssociateSbt && (
              <div className={styles.secondaryRow}>
                <Input
                  type="number"
                  value={assocSbtChainId}
                  onChange={(e) => setAssocSbtChainId(e.target.value)}
                  placeholder="chainId"
                  className={styles.secondaryField}
                />
                <Input
                  type="text"
                  value={assocSbtAddress}
                  onChange={(e) => setAssocSbtAddress(e.target.value)}
                  placeholder="0xSbtAddress"
                  className={styles.secondaryField}
                />
              </div>
            )}
          </div>
        )}

        {secondaryAssociationType === 'session' && (
          <div className={styles.secondaryAssoc}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={alsoAssociateSession}
                onChange={(e) => setAlsoAssociateSession(e.target.checked)}
                disabled={!normalizedSecondarySessionIdHex}
              />
              Also associate with session
              {!normalizedSecondarySessionIdHex && <span className={styles.muted}> (sessionId unavailable)</span>}
            </label>
          </div>
        )}
      </div>

      <div className={styles.list}>
        {!docs.length && !loading && canList && (
          <div className={styles.empty}>No documents found yet.</div>
        )}
        {docs.map((doc) => {
          const tagMap = doc?.tagMap || {};
          const storage = toStr(tagMap['CE-DocStorage']).trim().toLowerCase();
          const kind = toStr(tagMap['CE-DocKind']).trim().toLowerCase();
          const docRole = toStr(tagMap['CE-DocRole']).trim().toLowerCase();
          const mimeType = toStr(tagMap['CE-DocMime'] || doc?.data?.type).trim().toLowerCase();
          const isImageDoc = mimeType.startsWith('image/') || docRole === DOC_LIBRARY_DOC_ROLES.PHOTO;
          const name = toStr(tagMap['CE-DocName']).trim() || (kind === 'link' ? 'Link record' : (storage === 'lit-arweave' ? 'Encrypted document' : 'Document'));
          const txId = toStr(doc?.txId).trim();
          const isEncryptedStorage = storage === 'lit-arweave' || storage === 'lit';
          const arweaveUrl = txId ? arweaveScripts.buildArweaveGatewayUrl(txId, 'https://arweave.net') : '';
          const litUrl = txId ? litStorage.buildLitArweaveUrl(txId) : '';
          const ts = doc?.block?.timestamp ? Number(doc.block.timestamp) * 1000 : null;
          const indexStatus = !doc?.block ? 'pending' : (ts ? 'indexed' : 'unconfirmed');
          const timeLabel = ts ? new Date(ts).toLocaleString() : (doc?.block ? 'Unconfirmed' : 'Pending indexing');
          const showPhotoRoleBadge = docRole === DOC_LIBRARY_DOC_ROLES.PHOTO;
          const showPhotoAnalysisRoleBadge = docRole === DOC_LIBRARY_DOC_ROLES.PHOTO_ANALYSIS;

          return (
            <div
              key={txId}
              className={styles.docRow}
              data-testid={E2E_TESTIDS.DOC_ROW}
              data-ce-doc-txid={txId}
              data-ce-doc-storage={storage || ''}
              data-ce-doc-kind={kind || ''}
              data-ce-index-status={indexStatus}
            >
              <div className={styles.docMeta}>
                <div className={styles.docName}>{name}</div>
                <div className={styles.docSub}>
                  {showPhotoRoleBadge && <span className={styles.badge}>photo</span>}
                  {showPhotoAnalysisRoleBadge && <span className={styles.badge}>photo analysis</span>}
                  {!showPhotoRoleBadge && isImageDoc && <span className={styles.badge}>image</span>}
                  <span className={styles.badge}>{kind || 'file'}</span>
                  <span className={styles.badge}>{storage || 'arweave'}</span>
                  <span className={styles.time}>{timeLabel}</span>
                </div>
              </div>
              <div className={styles.docActions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => openDoc(doc)}
                  title="View"
                  data-testid={E2E_TESTIDS.DOC_ROW_VIEW}
                >
                  <FontAwesomeIcon icon={faEye} />
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => copyToClipboard(isEncryptedStorage ? litUrl : arweaveUrl)} title="Copy link">
                  <FontAwesomeIcon icon={faCopy} />
                </button>
                <a
                  className={styles.iconBtn}
                  href={arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in Arweave gateway"
                  data-testid={E2E_TESTIDS.DOC_ROW_OPEN_ARWEAVE}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className={styles.loadingRow}>
            <FontAwesomeIcon icon={faSpinner} spin /> Loading…
          </div>
        )}

        {canList && docs.length > 0 && (
          <div className={styles.pagination}>
            <Button
              type="button"
              color="secondary"
              outline
              size="sm"
              onClick={() => loadDocs({ reset: false })}
              disabled={loading || !cursor}
            >
              Load more
            </Button>
          </div>
        )}
      </div>

      <Modal isOpen={viewerOpen} toggle={closeViewer} size="lg" centered data-testid={E2E_TESTIDS.DOC_VIEWER}>
        <ModalHeader toggle={closeViewer} data-testid={E2E_TESTIDS.DOC_VIEWER_TITLE}>
          {viewerTitle || 'Document'}
        </ModalHeader>
        <ModalBody>
          {renderViewerBody()}
        </ModalBody>
      </Modal>
    </div>
  );
}
