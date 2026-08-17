/** @file DocumentLibraryPanel.tsx */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import { Button, Modal, ModalBody, ModalHeader } from 'reactstrap';

import styles from './DocumentLibraryPanel.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { DOC_LIBRARY_ARWEAVE_GATEWAYS } from '../../variables/arweaveGateways.js';

import { arweaveClient as arweaveClient } from '../../utilities/arweave/arweaveClient.js';
import {
  buildSbtAccessControlConditions,
  getUnsupportedLitContractAccessControlError,
  getGlobalLitHooks,
  litStorage,
  resolveLitChain,
} from '../../utilities/crypto/litProtocol.js';
import {
  buildDocLibraryCommonTags,
  buildDocLibraryPlaintextFileMetaTags,
  buildDocLibrarySbtTags,
  buildDocLibrarySessionTags,
  mergeTags,
  normalizeSbtAddress,
  normalizeSessionIdHex,
} from '../../utilities/docLibrary/tags.js';
import { resolveArweaveGraphqlUrl, resolveArweaveGraphqlUrls } from '../../utilities/docLibrary/config.js';
import { listArweaveTransactionsByTags } from '../../utilities/docLibrary/arweaveGraphql.js';
import { listSessionStorageRefsPage, readSessionStorageBlob } from '../../utilities/storage/storageClient.js';
import { STORAGE_BACKENDS, normalizeStorageRef } from '../../utilities/storage/storageRefs.js';
import {
  resolveDocUploadsGate,
  uploadDocLibraryFile,
  uploadDocLibraryUrlRecord,
} from '../../utilities/docLibrary/uploads.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { createLogger } from '../../utilities/logging.js';
import {
  DocumentLibraryList,
  DocumentLibraryUploadControls,
  DocumentLibraryViewerBody,
} from './DocumentLibraryPanelViews';
import {
  resolveDocumentLibraryCapabilityRoute,
  resolveDocumentLibraryLitHooks,
  type DocumentLibraryPanelProps,
  type LitHooks,
  type SessionConfig,
} from './documentLibraryCapabilityRouting';
import { resolveDocumentLibraryAutoOpenDoc } from './documentLibraryAutoOpen';
import { buildSbtListFilters, buildSessionListFilters } from './documentLibraryListFilters';

const log = createLogger('DocumentLibraryPanel');

type TagEntry = {
  name: string;
  value: string;
};

type DocTagMap = Record<string, string>;

type DocData = {
  size: number | null;
  type: string | null;
};

type StorageRef = {
  backend: string;
  id: string;
  uri?: string;
  contentType?: string;
  encrypted?: boolean;
  [key: string]: unknown;
};

type NormalizeStorageRefOptions = {
  fallbackBackend?: string;
  legacyArweaveTxId?: unknown;
  encrypted?: boolean;
  resource?: string;
  [key: string]: unknown;
};

type SessionStorageContext = {
  account?: string | null;
  providerLike?: unknown;
  chainId?: number | string | null;
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
  storageRef?: StorageRef | null;
};

type CustomSbtEntry = {
  address: string;
  name?: string;
  chainId?: number | string | null;
  [key: string]: unknown;
};

type OpenableDoc = Pick<DocRecord, 'txId' | 'tagMap' | 'storageRef'>;

type DocUploadsGateState = {
  gate: unknown;
  lookupStatus: string;
  sbtAddresses: string[];
  chainId: number | string | null;
  mode: string;
  hasRecipients: boolean;
};

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
        litNetwork?: string;
        connectTimeout?: unknown;
        providerLike?: unknown;
        resourceAbilityRequests?: unknown;
      };
    };

type FetchArweaveBlobResult =
  { ok: true; blob: Blob; contentType: string } | { ok: false; error: string; stale?: boolean };

type UploadResult = {
  txId?: string;
  tagMap?: unknown;
  data?: Partial<DocData> | null;
  storage?: string;
  storageRef?: StorageRef | null;
};

const normalizeDocStorageRef = normalizeStorageRef as (
  input: unknown,
  opts?: NormalizeStorageRefOptions,
) => StorageRef | null;

const listSessionStorageRefsPageForDocs = listSessionStorageRefsPage as (opts: {
  sessionSlug?: string;
  sessionConfig?: SessionConfig;
  context?: SessionStorageContext | null;
  workerUrl?: string;
  resource?: string;
  cursor?: string | null;
  limit?: number;
}) => Promise<{
  items: Record<string, unknown>[];
  cursor: string | null;
  listComplete: boolean;
}>;

const readSessionStorageBlobForDocs = readSessionStorageBlob as (opts: {
  storageRef: StorageRef;
  sessionSlug?: string;
  sessionConfig?: SessionConfig;
  context?: SessionStorageContext | null;
  workerUrl?: string;
}) => Promise<Response>;

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

const resolveLitChainUntyped = resolveLitChain as (args: { chainId: number | null }) => string;

const getUnsupportedLitContractAccessControlErrorUntyped = getUnsupportedLitContractAccessControlError as (args: {
  chainId: number | null;
  litChain?: string | null;
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

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const normalizeDocTagMap = (value: unknown): DocTagMap => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toStr(entry)]),
  );
};

const buildTagMapFromTags = (tags: TagEntry[]): DocTagMap =>
  Object.fromEntries(tags.map(({ name, value }) => [name, value]));

const buildPendingDocRecord = ({
  txId,
  tagMap,
  data,
  storageRef,
}: {
  txId: string;
  tagMap?: unknown;
  data?: Partial<DocData> | null;
  storageRef?: StorageRef | null;
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
  storageRef: storageRef || null,
});

const buildDocRecordFromStorageItem = (item: Record<string, unknown>): DocRecord | null => {
  const storageRef = normalizeDocStorageRef(item?.storageRef, { fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE });
  if (!storageRef) return null;
  const metadata =
    item?.metadata && typeof item.metadata === 'object' ? (item.metadata as Record<string, unknown>) : {};
  const tagMap = buildTagMapFromTags(Array.isArray(metadata.tags) ? (metadata.tags as TagEntry[]) : []);
  tagMap['CE-DocStorage'] = storageRef.backend;
  tagMap['CE-DocKind'] = tagMap['CE-DocKind'] || 'file';
  if (storageRef.contentType && !tagMap['CE-DocMime']) tagMap['CE-DocMime'] = storageRef.contentType;
  return buildPendingDocRecord({
    txId: storageRef.id,
    tagMap,
    storageRef,
    data: {
      size: Number(metadata.size || 0) || null,
      type: storageRef.contentType || toStr(metadata.contentType).trim() || null,
    },
  });
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

const buildAsyncContextKeyPart = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch (_) {
    return String(value ?? '');
  }
};

const fetchArweaveBlobWithFallback = async (
  txId: string,
  opts: { gateways?: string[]; isCurrent?: () => boolean } = {},
): Promise<FetchArweaveBlobResult> => {
  const gateways = Array.isArray(opts.gateways) && opts.gateways.length ? opts.gateways : DOC_LIBRARY_ARWEAVE_GATEWAYS;
  const isCurrent = typeof opts.isCurrent === 'function' ? opts.isCurrent : null;

  let lastErr: unknown = null;
  for (const gw of gateways) {
    const url = arweaveClient.buildArweaveGatewayUrl(txId, gw);
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) {
        lastErr = new Error(`Arweave fetch failed (${resp.status})`);
        continue;
      }
      if (isCurrent && !isCurrent()) return { ok: false, error: '', stale: true };

      const blob = await resp.blob();
      if (isCurrent && !isCurrent()) return { ok: false, error: '', stale: true };
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
  litHooks: scopedLitHooks,
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
  showUploadControls = true,
}: DocumentLibraryPanelProps = {}) {
  const capabilityRoute = useMemo(
    () => resolveDocumentLibraryCapabilityRoute({ mode, sessionConfig, network }),
    [mode, network, sessionConfig],
  );
  const {
    usesWorkerCanonicalDocumentStorage,
    allowsLitDocumentControls,
    allowsSbtDocumentControls,
    documentUploadBlockedMessage,
    documentCapabilityNotice,
    documentNetwork,
    docProvider,
  } = capabilityRoute;
  const getActiveLitHooks = useCallback(
    () =>
      resolveDocumentLibraryLitHooks({
        allowsLitDocumentControls,
        scopedLitHooks,
        globalLitHooks: getGlobalLitHooks() as LitHooks,
      }),
    [allowsLitDocumentControls, scopedLitHooks],
  );
  const normalizedSessionIdHex = useMemo(() => normalizeSessionIdHex(sessionIdHex), [sessionIdHex]);
  const normalizedSbtAddress = useMemo(() => normalizeSbtAddress(sbtAddress), [sbtAddress]);
  const normalizedSecondarySessionIdHex = useMemo(
    () => normalizeSessionIdHex(secondarySessionIdHex),
    [secondarySessionIdHex],
  );
  const resolvedSbtChainId = useMemo(
    () => Number(sbtChainId || documentNetwork?.id || 0) || null,
    [documentNetwork?.id, sbtChainId],
  );

  const panelContextKey = useMemo(() => {
    const slug = toStr(sessionSlug).trim().toLowerCase();
    if (mode === 'session') {
      const id = normalizedSessionIdHex || '';
      return slug || id ? `session:${slug}:${id}` : '';
    }
    if (mode === 'sbt') {
      const chain = resolvedSbtChainId ? String(resolvedSbtChainId) : '';
      const addr = normalizedSbtAddress || '';
      const id = `${chain}:${addr}:${slug}`;
      return chain && addr ? `sbt:${id}` : '';
    }
    return '';
  }, [mode, sessionSlug, normalizedSessionIdHex, resolvedSbtChainId, normalizedSbtAddress]);

  const isArweaveBackedDocProvider =
    docProvider === STORAGE_BACKENDS.ARWEAVE || docProvider === STORAGE_BACKENDS.LIT_ARWEAVE;
  const isUploadableDocProvider = isArweaveBackedDocProvider || docProvider === STORAGE_BACKENDS.CLOUDFLARE;
  const canUploadDocuments = isUploadableDocProvider && !documentUploadBlockedMessage;
  const requiresLitDocumentStorage = docProvider === STORAGE_BACKENDS.LIT_ARWEAVE;
  const graphqlUrl = useMemo(() => toStr(resolveArweaveGraphqlUrl(sessionConfig)).trim(), [sessionConfig]);
  const graphqlUrls = useMemo(() => resolveArweaveGraphqlUrls(sessionConfig), [sessionConfig]);

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
  const sessionHasLitChipotle = useMemo(() => {
    const litCredentials =
      sessionConfig &&
      typeof sessionConfig === 'object' &&
      sessionConfig.litCredentials &&
      typeof sessionConfig.litCredentials === 'object' &&
      !Array.isArray(sessionConfig.litCredentials)
        ? (sessionConfig.litCredentials as Record<string, unknown>)
        : null;
    const hasCompleteLitCredentials = !!(
      litCredentials &&
      toStr(litCredentials?.litApiBase).trim() &&
      toStr(litCredentials?.litActionCid).trim() &&
      toStr(litCredentials?.litPkpId).trim()
    );
    const litConfig =
      sessionConfig &&
      typeof sessionConfig === 'object' &&
      sessionConfig.lit &&
      typeof sessionConfig.lit === 'object' &&
      !Array.isArray(sessionConfig.lit)
        ? (sessionConfig.lit as Record<string, unknown>)
        : null;
    const litNetworkHint = toStr(litConfig?.network || sessionConfig?.litNetwork)
      .trim()
      .toLowerCase();
    return !!(
      toStr(sessionConfig?.corsWorkerUrl).trim() &&
      (hasCompleteLitCredentials || litNetworkHint === 'chipotle' || docUploadsGate.hasRecipients)
    );
  }, [docUploadsGate.hasRecipients, sessionConfig]);
  const sessionGateUnsupportedMessage = useMemo(
    () =>
      allowsSbtDocumentControls && docUploadsGate.hasRecipients && !sessionHasLitChipotle
        ? getUnsupportedLitContractAccessControlErrorUntyped({
            chainId: Number(docUploadsGate.chainId || documentNetwork?.id || 0) || null,
          })
        : '',
    [
      allowsSbtDocumentControls,
      docUploadsGate.chainId,
      docUploadsGate.hasRecipients,
      documentNetwork?.id,
      sessionHasLitChipotle,
    ],
  );
  const docAsyncConfigKey = useMemo(
    () =>
      buildAsyncContextKeyPart({
        corsWorkerUrl: toStr(sessionConfig?.corsWorkerUrl).trim(),
        docLibrary: sessionConfig?.docLibrary || null,
        docProvider,
        docUploadsGate,
        graphqlUrl,
        graphqlUrls,
        lit: sessionConfig?.lit || null,
        litNetwork: toStr(sessionConfig?.litNetwork).trim(),
        storageProfile: sessionConfig?.storageProfile || null,
      }),
    [docProvider, docUploadsGate, graphqlUrl, graphqlUrls, sessionConfig],
  );

  const locationSearch = typeof window !== 'undefined' ? window.location.search || '' : '';

  const autoOpenDoc = useMemo(
    () => resolveDocumentLibraryAutoOpenDoc({ locationSearch, usesWorkerCanonicalDocumentStorage }),
    [locationSearch, usesWorkerCanonicalDocumentStorage],
  );

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
  const [fileUploadPending, setFileUploadPending] = useState(false);
  const [urlUploadPending, setUrlUploadPending] = useState(false);

  // Track whether the user has manually changed encryption defaults; if they have,
  // don't auto-reset when gates/config load asynchronously.
  const userEncryptionOverrideRef = useRef(false);
  const lastContextKeyRef = useRef('');
  const [locked, setLocked] = useState(false);
  const effectiveLocked = allowsLitDocumentControls && locked;
  const [audienceMode, setAudienceMode] = useState('custom'); // "sessionGate" | "custom"
  const [customSbtList, setCustomSbtList] = useState<CustomSbtEntry[]>([]);
  const [customGateMode, setCustomGateMode] = useState('any'); // any|all

  const [alsoAssociateSbt, setAlsoAssociateSbt] = useState(false);
  const [assocSbtChainId, setAssocSbtChainId] = useState<number | string>(
    Number(sbtChainId || documentNetwork?.id || 0) || '',
  );
  const [assocSbtAddress, setAssocSbtAddress] = useState('');

  const [alsoAssociateSession, setAlsoAssociateSession] = useState(false);

  useEffect(() => {
    if (allowsLitDocumentControls) return;
    userEncryptionOverrideRef.current = false;
    setLocked(false);
  }, [allowsLitDocumentControls]);

  useEffect(() => {
    if (allowsSbtDocumentControls) return;
    setAudienceMode('custom');
    setCustomSbtList([]);
    setCustomGateMode('any');
    setAlsoAssociateSbt(false);
    setAssocSbtChainId('');
    setAssocSbtAddress('');
  }, [allowsSbtDocumentControls]);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerText, setViewerText] = useState('');
  const [viewerBlobUrl, setViewerBlobUrl] = useState('');
  const [viewerMime, setViewerMime] = useState('');

  const autoOpenedRef = useRef('');
  const autoOpeningRef = useRef('');
  const viewerRequestSeqRef = useRef(0);
  const viewerContextKey = useMemo(
    () =>
      [
        panelContextKey,
        toStr(account).trim().toLowerCase(),
        String(documentNetwork?.id || ''),
        loginComplete ? '1' : '0',
        docAsyncConfigKey,
      ].join('|'),
    [account, docAsyncConfigKey, documentNetwork?.id, loginComplete, panelContextKey],
  );
  const activeViewerContextKeyRef = useRef(viewerContextKey);
  activeViewerContextKeyRef.current = viewerContextKey;
  const activeUploadContextKeyRef = useRef(viewerContextKey);
  activeUploadContextKeyRef.current = viewerContextKey;
  const activeFileRef = useRef<File | null>(file);
  activeFileRef.current = file;
  const activeUrlInputRef = useRef(urlInput);
  activeUrlInputRef.current = urlInput;
  const activeUrlTitleRef = useRef(urlTitle);
  activeUrlTitleRef.current = urlTitle;
  const fileUploadInFlightRef = useRef(false);
  const urlUploadInFlightRef = useRef(false);
  const fileUploadAttemptSeqRef = useRef(0);
  const urlUploadAttemptSeqRef = useRef(0);

  useEffect(
    () => () => {
      viewerRequestSeqRef.current += 1;
      listRequestSeqRef.current += 1;
      fileUploadAttemptSeqRef.current += 1;
      urlUploadAttemptSeqRef.current += 1;
      activeListQueryKeyRef.current = '__unmounted__';
      activeViewerContextKeyRef.current = '__unmounted__';
      activeUploadContextKeyRef.current = '__unmounted__';
      loadingRef.current = false;
      fileUploadInFlightRef.current = false;
      urlUploadInFlightRef.current = false;
    },
    [],
  );

  useEffect(() => {
    viewerRequestSeqRef.current += 1;
    fileUploadAttemptSeqRef.current += 1;
    urlUploadAttemptSeqRef.current += 1;
    setViewerOpen(false);
    setViewerLoading(false);
    setViewerError('');
    setViewerTitle('');
    setViewerText('');
    setViewerBlobUrl('');
    setViewerMime('');
    fileUploadInFlightRef.current = false;
    urlUploadInFlightRef.current = false;
    setFileUploadPending(false);
    setUrlUploadPending(false);
  }, [viewerContextKey]);

  useEffect(() => {
    return () => {
      if (!viewerBlobUrl) return;
      if (typeof URL === 'undefined') return;
      try {
        URL.revokeObjectURL(viewerBlobUrl);
      } catch (e) {
        log.warn('DocumentLibraryPanel: cleanup', e);
      }
    };
  }, [viewerBlobUrl]);

  useEffect(() => {
    if (!panelContextKey) return;
    if (lastContextKeyRef.current === panelContextKey) return;
    lastContextKeyRef.current = panelContextKey;

    // Reset per-context encryption overrides so each session/group starts from defaults.
    userEncryptionOverrideRef.current = false;
    setCustomGateMode('any');

    // Prevent accidental re-use of a prior group's custom audience list when the
    // panel is reused across navigation.
    if (mode === 'sbt') {
      setCustomSbtList(normalizedSbtAddress ? [{ address: normalizedSbtAddress }] : []);
    } else {
      setCustomSbtList([]);
    }
  }, [panelContextKey, mode, normalizedSbtAddress]);

  useEffect(() => {
    const shouldLock =
      requiresLitDocumentStorage ||
      (allowsSbtDocumentControls &&
        docProvider !== STORAGE_BACKENDS.CLOUDFLARE &&
        !!docUploadsGate.hasRecipients &&
        !sessionGateUnsupportedMessage);
    if (userEncryptionOverrideRef.current) return;
    setLocked(shouldLock);
    setAudienceMode(shouldLock && docUploadsGate.hasRecipients ? 'sessionGate' : 'custom');
  }, [
    docProvider,
    docUploadsGate.hasRecipients,
    allowsSbtDocumentControls,
    panelContextKey,
    requiresLitDocumentStorage,
    sessionGateUnsupportedMessage,
  ]);

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
    if (requiresLitDocumentStorage) {
      setLocked(true);
      return;
    }
    setLocked((v) => !v);
  }, [requiresLitDocumentStorage]);

  const listFilters = useMemo(() => {
    if (!isArweaveBackedDocProvider) return [];
    if (mode === 'session') return buildSessionListFilters(normalizedSessionIdHex);
    if (mode === 'sbt') {
      return buildSbtListFilters({
        chainId: sbtChainId || documentNetwork?.id || null,
        sbtAddress: normalizedSbtAddress,
      });
    }
    return [];
  }, [documentNetwork?.id, isArweaveBackedDocProvider, mode, normalizedSessionIdHex, normalizedSbtAddress, sbtChainId]);

  const listQueryKey = useMemo(
    () =>
      JSON.stringify({
        provider: docProvider,
        graphqlUrl,
        graphqlUrls,
        listFilters,
      }),
    [docProvider, graphqlUrl, graphqlUrls, listFilters],
  );

  const canList = useMemo(() => {
    if (docProvider === STORAGE_BACKENDS.CLOUDFLARE) return mode === 'session' && !!toStr(sessionSlug).trim();
    if (!isArweaveBackedDocProvider) return false;
    if (mode === 'session') return !!normalizedSessionIdHex;
    if (mode === 'sbt') return !!normalizedSbtAddress && !!Number(sbtChainId || documentNetwork?.id || 0);
    return false;
  }, [
    docProvider,
    isArweaveBackedDocProvider,
    mode,
    normalizedSessionIdHex,
    normalizedSbtAddress,
    documentNetwork?.id,
    sbtChainId,
    sessionSlug,
  ]);
  const listRunKey = useMemo(
    () => `${viewerContextKey}|${canList ? '1' : '0'}|${listQueryKey}`,
    [canList, listQueryKey, viewerContextKey],
  );
  activeListQueryKeyRef.current = listRunKey;

  const loadDocs = useCallback(
    async ({ reset }: { reset?: boolean } = {}) => {
      if (!canList) return;
      if (loadingRef.current && !reset) return;
      if (!reset && !cursorRef.current) return;
      setError('');
      const requestSeq = (listRequestSeqRef.current += 1);
      const expectedQueryKey = listRunKey;
      loadingRef.current = true;
      setLoading(true);
      try {
        const after = reset ? null : cursorRef.current;
        let nextCursor: string | null = null;
        let edges: DocRecord[] = [];
        if (docProvider === STORAGE_BACKENDS.CLOUDFLARE) {
          const page = await listSessionStorageRefsPageForDocs({
            sessionSlug,
            sessionConfig,
            context: { account, providerLike: provider, chainId: documentNetwork?.id || null },
            resource: 'docsContext',
            cursor: after,
            limit: pageSize,
          });
          edges = (Array.isArray(page?.items) ? page.items : [])
            .map((item: Record<string, unknown>) => buildDocRecordFromStorageItem(item))
            .filter(Boolean) as DocRecord[];
          nextCursor = toStr(page?.cursor).trim() || null;
        } else {
          edges = (await listArweaveTransactionsByTags({
            graphqlUrl,
            graphqlUrls,
            tags: listFilters,
            first: pageSize,
            after,
          })) as DocRecord[];
          nextCursor = edges.length ? edges[edges.length - 1].cursor : null;
        }

        if (listRequestSeqRef.current !== requestSeq || activeListQueryKeyRef.current !== expectedQueryKey) return;

        setDocs((prev) => {
          const base = reset ? [] : Array.isArray(prev) ? prev : [];
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
              tags: Array.isArray(edge.tags) ? edge.tags : Array.isArray(prevDoc.tags) ? prevDoc.tags : [],
              tagMap:
                edge.tagMap && typeof edge.tagMap === 'object'
                  ? normalizeDocTagMap(edge.tagMap)
                  : prevDoc.tagMap && typeof prevDoc.tagMap === 'object'
                    ? prevDoc.tagMap
                    : {},
            };
          });
          return next;
        });
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
      } catch (err) {
        if (listRequestSeqRef.current !== requestSeq || activeListQueryKeyRef.current !== expectedQueryKey) return;
        setError(getErrorMessage(err, 'Failed to load docs.'));
      } finally {
        if (listRequestSeqRef.current === requestSeq && activeListQueryKeyRef.current === expectedQueryKey) {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [
      account,
      canList,
      docProvider,
      graphqlUrl,
      graphqlUrls,
      listFilters,
      documentNetwork?.id,
      pageSize,
      provider,
      sessionConfig,
      sessionSlug,
      listRunKey,
    ],
  );

  useEffect(() => {
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
  }, [canList, listRunKey, loadDocs]);

  const closeViewer = useCallback(() => {
    viewerRequestSeqRef.current += 1;
    setViewerOpen(false);
    setViewerLoading(false);
    setViewerError('');
    setViewerTitle('');
    setViewerText('');
    setViewerBlobUrl('');
    setViewerMime('');
  }, []);

  const openDoc = useCallback(
    async (doc: OpenableDoc): Promise<boolean> => {
      const txId = toStr(doc?.txId).trim();
      if (!txId) return false;
      const requestSeq = viewerRequestSeqRef.current + 1;
      viewerRequestSeqRef.current = requestSeq;
      const viewerContextAtStart = activeViewerContextKeyRef.current;
      const isCurrentViewerRequest = () =>
        viewerRequestSeqRef.current === requestSeq && activeViewerContextKeyRef.current === viewerContextAtStart;
      const revokeStaleBlobUrl = (blobUrl: string) => {
        if (!blobUrl || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
        try {
          URL.revokeObjectURL(blobUrl);
        } catch (e) {
          log.warn('DocumentLibraryPanel: stale blob cleanup', e);
        }
      };
      const applyTextViewerState = ({ title, mime, text }: { title: string; mime: string; text: string }) => {
        if (!isCurrentViewerRequest()) return false;
        setViewerTitle(title);
        setViewerMime(mime);
        setViewerText(text);
        setViewerLoading(false);
        return true;
      };
      const applyBlobViewerState = ({ title, mime, blobUrl }: { title: string; mime: string; blobUrl: string }) => {
        if (!isCurrentViewerRequest()) {
          revokeStaleBlobUrl(blobUrl);
          return false;
        }
        setViewerTitle(title);
        setViewerMime(mime);
        setViewerBlobUrl(blobUrl);
        setViewerLoading(false);
        return true;
      };

      const tagMap = doc?.tagMap || {};
      const storage = toStr(tagMap['CE-DocStorage']).trim().toLowerCase();
      const kind = toStr(tagMap['CE-DocKind']).trim().toLowerCase();
      const isEncrypted = storage === 'lit-arweave' || storage === 'lit';
      const storageRef = normalizeDocStorageRef(doc?.storageRef || { backend: storage, id: txId }, {
        fallbackBackend: storage || STORAGE_BACKENDS.ARWEAVE,
      });
      const isCloudflareStorage = storageRef?.backend === STORAGE_BACKENDS.CLOUDFLARE;

      setViewerOpen(true);
      setViewerLoading(true);
      setViewerError('');
      setViewerText('');
      setViewerMime('');
      setViewerBlobUrl('');
      setViewerTitle(isEncrypted ? 'Decrypting…' : 'Loading…');

      try {
        if (isCloudflareStorage) {
          if (isEncrypted) {
            throw new Error('Lit-encrypted Cloudflare document reads are not implemented yet.');
          }
          const response = await readSessionStorageBlobForDocs({
            storageRef,
            sessionSlug,
            sessionConfig,
            context: { account, providerLike: provider, chainId: documentNetwork?.id || null },
          });
          if (!isCurrentViewerRequest()) return false;
          const blob = await response.blob();
          if (!isCurrentViewerRequest()) return false;
          const mime = toStr(response.headers.get('content-type') || blob.type || storageRef?.contentType || '').trim();
          if (kind === 'link' || isTextLikeMime(mime)) {
            const text = await blob.text();
            return applyTextViewerState({
              title: toStr(tagMap['CE-DocName']).trim() || (kind === 'link' ? 'Link record' : 'Document'),
              mime: mime || (kind === 'link' ? 'application/json' : 'text/plain'),
              text: text || '',
            });
          }
          const blobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
          return applyBlobViewerState({
            title: toStr(tagMap['CE-DocName']).trim() || 'Document',
            mime,
            blobUrl,
          });
        }

        if (isEncrypted) {
          const litHooks = getActiveLitHooks();
          if (!provider || !toStr(account).trim()) {
            throw new Error('Connect a wallet to decrypt this document.');
          }
          const { payload } = await litStorage.downloadEncryptedArweaveData({
            url: litStorage.buildLitArweaveUrl(txId),
            providerLike: provider,
            account,
            chainId: documentNetwork?.id || null,
            ...(litHooks && typeof litHooks.getKey === 'function' ? { lit: { getKey: litHooks.getKey } } : {}),
            arweave: {
              debugContext: {
                category: 'doc_lit_payload',
                caller: 'DocumentLibraryPanel.openDoc.encrypted',
                slug: panelContextKey || '',
                chainId: Number(documentNetwork?.id || 0) || null,
              },
            },
          });
          if (!isCurrentViewerRequest()) return false;

          const name = toStr(payload?.name || '').trim() || (kind === 'link' ? 'Encrypted link' : 'Encrypted document');
          const mime = toStr(payload?.mime || '').trim();
          const text = litStorage.decodeLitPayloadToText(payload);
          if (text) {
            return applyTextViewerState({
              title: name,
              mime: mime || 'text/plain',
              text,
            });
          }
          const blob = litStorage.decodeLitPayloadToBlob(payload);
          if (!blob) {
            throw new Error('Unable to decode encrypted document.');
          }
          const blobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
          return applyBlobViewerState({
            title: name,
            mime: blob.type || mime || '',
            blobUrl,
          });
        }

        if (kind === 'link') {
          const text = await arweaveClient.downloadDataFromArweave(txId, {
            debugContext: {
              category: 'doc_link_payload',
              caller: 'DocumentLibraryPanel.openDoc.link',
              slug: panelContextKey || '',
              chainId: Number(documentNetwork?.id || 0) || null,
            },
          });
          return applyTextViewerState({
            title: toStr(tagMap['CE-DocName']).trim() || 'Link record',
            mime: 'application/json',
            text: text || '',
          });
        }

        const res = await fetchArweaveBlobWithFallback(txId, { isCurrent: isCurrentViewerRequest });
        if (!isCurrentViewerRequest()) return false;
        if (!res.ok && res.stale) return false;
        if (!res.ok) throw new Error(res.error || 'Failed to fetch document.');
        const blob = res.blob;
        const mime = toStr(res.contentType || blob.type || '').trim();
        if (isTextLikeMime(mime)) {
          const text = await blob.text();
          return applyTextViewerState({
            title: toStr(tagMap['CE-DocName']).trim() || 'Document',
            mime: mime || 'text/plain',
            text: text || '',
          });
        }
        const blobUrl = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : '';
        return applyBlobViewerState({
          title: toStr(tagMap['CE-DocName']).trim() || 'Document',
          mime,
          blobUrl,
        });
      } catch (err) {
        if (!isCurrentViewerRequest()) return false;
        setViewerLoading(false);
        setViewerError(getErrorMessage(err, 'Failed to open document.'));
        setViewerTitle('Error');
        return false;
      }
    },
    [provider, account, documentNetwork?.id, panelContextKey, getActiveLitHooks, sessionConfig, sessionSlug],
  );

  useEffect(() => {
    if (!autoOpenDoc || !autoOpenDoc.txId) return;

    const key = `${panelContextKey}:${autoOpenDoc.storageRef?.backend || ''}:${autoOpenDoc.txId}`;
    if (autoOpenedRef.current === key) return;
    if (autoOpeningRef.current === key) return;

    const storage = toStr(autoOpenDoc.tagMap?.['CE-DocStorage']).trim().toLowerCase();
    const wantsEncrypted = storage === 'lit-arweave' || storage === 'lit';
    if (wantsEncrypted && (!loginComplete || !toStr(account).trim() || !provider)) return;

    let cancelled = false;
    autoOpeningRef.current = key;
    openDoc({ txId: autoOpenDoc.txId, tagMap: autoOpenDoc.tagMap, storageRef: autoOpenDoc.storageRef })
      .then((opened) => {
        if (autoOpeningRef.current === key) autoOpeningRef.current = '';
        if (cancelled || !opened) return;
        autoOpenedRef.current = key;

        // Clear params so refresh/back doesn't re-open repeatedly.
        try {
          const url = new URL(window.location.href);
          ['__ceDocTx', '__ceDocRef', '__ceDocStorage', '__ceDocKind', '__ceDocName'].forEach((param) => {
            url.searchParams.delete(param);
          });
          window.history.replaceState({}, '', url.toString());
        } catch (e) {
          log.warn('DocumentLibraryPanel: fallback', e);
        }
      })
      .catch((error) => {
        if (autoOpeningRef.current === key) autoOpeningRef.current = '';
        log.warn('DocumentLibraryPanel: auto-open failed', error);
      });

    return () => {
      cancelled = true;
      if (autoOpeningRef.current === key) autoOpeningRef.current = '';
    };
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
    setCustomSbtList((prev) =>
      Array.isArray(prev) ? prev.filter((e) => (e?.address || '').toLowerCase() !== target) : [],
    );
  }, []);

  const resolveAssociationTags = useCallback(
    ({
      kind,
      storage,
      plaintextMeta,
    }: {
      kind?: string;
      storage?: string;
      plaintextMeta?: TagEntry[];
    } = {}): TagEntry[] => {
      const common = buildDocLibraryCommonTags({ kind, storage });

      const primarySession =
        mode === 'session' ? buildDocLibrarySessionTags({ sessionIdHex: normalizedSessionIdHex }) : [];
      const primarySbt =
        mode === 'sbt'
          ? buildDocLibrarySbtTags({
              chainId: sbtChainId || documentNetwork?.id || null,
              sbtAddress: normalizedSbtAddress,
            })
          : [];

      const secondarySbt =
        allowsSbtDocumentControls && secondaryAssociationType === 'sbt' && alsoAssociateSbt
          ? buildDocLibrarySbtTags({ chainId: assocSbtChainId, sbtAddress: assocSbtAddress })
          : [];
      const secondarySession =
        secondaryAssociationType === 'session' && alsoAssociateSession && normalizedSecondarySessionIdHex
          ? buildDocLibrarySessionTags({ sessionIdHex: normalizedSecondarySessionIdHex })
          : [];

      return mergeTags(common, primarySession, primarySbt, secondarySbt, secondarySession, plaintextMeta) as TagEntry[];
    },
    [
      mode,
      normalizedSessionIdHex,
      sbtChainId,
      documentNetwork?.id,
      normalizedSbtAddress,
      allowsSbtDocumentControls,
      secondaryAssociationType,
      alsoAssociateSbt,
      assocSbtChainId,
      assocSbtAddress,
      alsoAssociateSession,
      normalizedSecondarySessionIdHex,
    ],
  );

  const resolveEncryptAudience = useCallback((): EncryptAudience => {
    if (!effectiveLocked) return { ok: true, encrypted: false };
    if (!allowsSbtDocumentControls) {
      return {
        ok: false,
        error: 'This session profile does not enable on-chain SBT document audiences.',
      };
    }
    const litHooks = getActiveLitHooks();
    const saveKey = litHooks?.saveKey;
    if (!litHooks || typeof saveKey !== 'function') {
      return { ok: false, error: 'Lit hooks not initialized; connect a wallet to encrypt.' };
    }
    const litHookOptions = {
      saveKey,
      ...(litHooks.litNetwork ? { litNetwork: litHooks.litNetwork } : {}),
      ...(litHooks.connectTimeout ? { connectTimeout: litHooks.connectTimeout } : {}),
      ...(litHooks.providerLike ? { providerLike: litHooks.providerLike } : {}),
      ...(litHooks.resourceAbilityRequests ? { resourceAbilityRequests: litHooks.resourceAbilityRequests } : {}),
    };

    if (audienceMode === 'sessionGate') {
      if (!docUploadsGate.hasRecipients || sessionGateUnsupportedMessage) {
        return {
          ok: false,
          error: sessionGateUnsupportedMessage || 'Session docUploads gate is unavailable or empty.',
        };
      }
      const chainId = Number(docUploadsGate.chainId || documentNetwork?.id || 0) || null;
      const litChain = resolveLitChainUntyped({ chainId });
      const acc = buildSbtAccessControlConditionsUntyped({
        sbtAddresses: docUploadsGate.sbtAddresses,
        chainId,
        litChain,
        mode: docUploadsGate.mode || 'any',
      });
      if (!acc) return { ok: false, error: 'Session docUploads gate has no valid SBT addresses.' };
      return { ok: true, encrypted: true, chainId, litChain, accessControlConditions: acc, litHooks: litHookOptions };
    }

    const list = (customSbtList || []).map((e) => e.address).filter(Boolean);
    const chainId = Number(sbtChainId || docUploadsGate.chainId || documentNetwork?.id || 0) || null;
    const litChain = resolveLitChainUntyped({ chainId });
    const customUnsupportedMessage = sessionHasLitChipotle
      ? ''
      : getUnsupportedLitContractAccessControlErrorUntyped({ chainId, litChain });
    if (customUnsupportedMessage) {
      return { ok: false, error: customUnsupportedMessage };
    }
    const acc = buildSbtAccessControlConditionsUntyped({
      sbtAddresses: list,
      chainId,
      litChain,
      mode: customGateMode || 'any',
    });
    if (!acc) return { ok: false, error: 'Add at least one SBT address to encrypt.' };
    return { ok: true, encrypted: true, chainId, litChain, accessControlConditions: acc, litHooks: litHookOptions };
  }, [
    effectiveLocked,
    allowsSbtDocumentControls,
    audienceMode,
    docUploadsGate.hasRecipients,
    docUploadsGate.chainId,
    docUploadsGate.mode,
    docUploadsGate.sbtAddresses,
    documentNetwork?.id,
    customSbtList,
    customGateMode,
    sessionGateUnsupportedMessage,
    sessionHasLitChipotle,
    sbtChainId,
    getActiveLitHooks,
  ]);

  const uploadFile = useCallback(async () => {
    if (fileUploadInFlightRef.current) return;
    if (!isUploadableDocProvider) return;
    if (!file) return;
    if (documentUploadBlockedMessage) {
      setError(documentUploadBlockedMessage);
      return;
    }
    if (!loginComplete && typeof toggleLoginModal === 'function') {
      toggleLoginModal(true);
      return;
    }

    setError('');
    if (requiresLitDocumentStorage && !effectiveLocked) {
      setError('Lit-Arweave session document storage requires encrypted uploads.');
      return;
    }
    if (effectiveLocked && docProvider === STORAGE_BACKENDS.CLOUDFLARE) {
      setError(
        'Lit-encrypted Cloudflare document uploads are not implemented yet. Upload plaintext to use worker-enforced storage access.',
      );
      return;
    }
    const storage =
      docProvider === STORAGE_BACKENDS.CLOUDFLARE
        ? STORAGE_BACKENDS.CLOUDFLARE
        : effectiveLocked
          ? STORAGE_BACKENDS.LIT_ARWEAVE
          : STORAGE_BACKENDS.ARWEAVE;
    const plaintextMeta = effectiveLocked
      ? []
      : buildDocLibraryPlaintextFileMetaTags({ name: file.name, mime: file.type, size: file.size });
    const tags = resolveAssociationTags({ kind: 'file', storage, plaintextMeta });

    // Arweave-backed session docs require sessionIdHex tags; Cloudflare storage is session-slug scoped.
    if (isArweaveBackedDocProvider && mode === 'session' && !normalizedSessionIdHex) {
      setError('Session ID is unavailable; cannot upload session docs.');
      return;
    }
    if (mode === 'sbt' && (!normalizedSbtAddress || !Number(sbtChainId || documentNetwork?.id || 0))) {
      setError('SBT association is missing; cannot upload group docs.');
      return;
    }

    const uploadContextKey = activeUploadContextKeyRef.current;
    const uploadAttemptSeq = (fileUploadAttemptSeqRef.current += 1);
    const submittedFile = file;
    const isCurrentUploadContext = () => activeUploadContextKeyRef.current === uploadContextKey;
    const isCurrentUploadAttemptSeq = () => fileUploadAttemptSeqRef.current === uploadAttemptSeq;
    const isCurrentUploadAttempt = () => isCurrentUploadContext() && activeFileRef.current === submittedFile;
    fileUploadInFlightRef.current = true;
    setFileUploadPending(true);

    try {
      if (!effectiveLocked) {
        const result = await uploadDocLibraryFileUntyped({
          file,
          sessionSlug,
          sessionConfig,
          account,
          providerLike: provider,
          chainId: documentNetwork?.id || null,
          tags,
        });
        if (!isCurrentUploadContext()) return;
        const txId = toStr(result?.txId).trim();
        if (txId) {
          setDocs((prev) => [
            buildPendingDocRecord({
              txId,
              tagMap: result.tagMap || buildTagMapFromTags(tags),
              data: result.data || { size: file.size || null, type: file.type || null },
              storageRef: result.storageRef || null,
            }),
            ...prev,
          ]);
        }
        if (isCurrentUploadAttempt()) setFile(null);
        return;
      }

      const audience = resolveEncryptAudience();
      if (!audience.ok || !audience.encrypted) {
        throw new Error(
          audience.ok ? 'Encryption audience unavailable.' : audience.error || 'Encryption audience unavailable.',
        );
      }

      const result = await uploadDocLibraryFileUntyped({
        file,
        sessionSlug,
        sessionConfig,
        account,
        providerLike: provider,
        chainId: documentNetwork?.id || null,
        tags,
        encryption: {
          enabled: true,
          saveKey: audience.litHooks.saveKey,
          accessControlConditions: audience.accessControlConditions,
          litChain: audience.litChain,
          chainId: audience.chainId,
          ...(audience.litHooks.litNetwork ? { litNetwork: audience.litHooks.litNetwork } : {}),
          ...(audience.litHooks.connectTimeout ? { connectTimeout: audience.litHooks.connectTimeout } : {}),
          ...(audience.litHooks.providerLike ? { providerLike: audience.litHooks.providerLike } : {}),
          ...(audience.litHooks.resourceAbilityRequests
            ? { resourceAbilityRequests: audience.litHooks.resourceAbilityRequests }
            : {}),
          contextLabel: `doc:${sessionSlug || ''}`,
        },
      });
      if (!isCurrentUploadContext()) return;

      const txId = toStr(result?.txId).trim();
      if (txId) {
        setDocs((prev) => [
          buildPendingDocRecord({
            txId,
            tagMap: result.tagMap || buildTagMapFromTags(tags),
            data: result.data || { size: null, type: 'application/json' },
            storageRef: result.storageRef || null,
          }),
          ...prev,
        ]);
      }
      if (isCurrentUploadAttempt()) setFile(null);
    } catch (err) {
      if (isCurrentUploadAttempt()) {
        setError(getErrorMessage(err, 'Upload failed.'));
      }
    } finally {
      if (isCurrentUploadAttemptSeq() && isCurrentUploadContext()) {
        fileUploadInFlightRef.current = false;
        setFileUploadPending(false);
      }
    }
  }, [
    docProvider,
    documentUploadBlockedMessage,
    isArweaveBackedDocProvider,
    isUploadableDocProvider,
    requiresLitDocumentStorage,
    file,
    loginComplete,
    toggleLoginModal,
    effectiveLocked,
    provider,
    account,
    documentNetwork?.id,
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
    if (urlUploadInFlightRef.current) return;
    if (!isUploadableDocProvider) return;
    const url = toStr(urlInput).trim();
    if (!url) return;
    if (documentUploadBlockedMessage) {
      setError(documentUploadBlockedMessage);
      return;
    }
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

    if (requiresLitDocumentStorage && !effectiveLocked) {
      setError('Lit-Arweave session document storage requires encrypted uploads.');
      return;
    }
    if (effectiveLocked && docProvider === STORAGE_BACKENDS.CLOUDFLARE) {
      setError(
        'Lit-encrypted Cloudflare document uploads are not implemented yet. Upload plaintext to use worker-enforced storage access.',
      );
      return;
    }
    const storage =
      docProvider === STORAGE_BACKENDS.CLOUDFLARE
        ? STORAGE_BACKENDS.CLOUDFLARE
        : effectiveLocked
          ? STORAGE_BACKENDS.LIT_ARWEAVE
          : STORAGE_BACKENDS.ARWEAVE;
    const plaintextMeta = effectiveLocked
      ? []
      : buildDocLibraryPlaintextFileMetaTags({ name: record.title || record.url, mime: 'application/json', size: '' });
    const tags = resolveAssociationTags({ kind: 'link', storage, plaintextMeta });

    if (isArweaveBackedDocProvider && mode === 'session' && !normalizedSessionIdHex) {
      setError('Session ID is unavailable; cannot upload session docs.');
      return;
    }
    if (mode === 'sbt' && (!normalizedSbtAddress || !Number(sbtChainId || documentNetwork?.id || 0))) {
      setError('SBT association is missing; cannot upload group docs.');
      return;
    }

    const uploadContextKey = activeUploadContextKeyRef.current;
    const uploadAttemptSeq = (urlUploadAttemptSeqRef.current += 1);
    const submittedUrlInput = urlInput;
    const submittedUrlTitle = urlTitle;
    const isCurrentUploadContext = () => activeUploadContextKeyRef.current === uploadContextKey;
    const isCurrentUploadAttemptSeq = () => urlUploadAttemptSeqRef.current === uploadAttemptSeq;
    const isCurrentUrlUploadAttempt = () =>
      isCurrentUploadContext() &&
      activeUrlInputRef.current === submittedUrlInput &&
      activeUrlTitleRef.current === submittedUrlTitle;
    urlUploadInFlightRef.current = true;
    setUrlUploadPending(true);

    try {
      if (!effectiveLocked) {
        const result = await uploadDocLibraryUrlRecordUntyped({
          url,
          title: urlTitle,
          sessionSlug,
          sessionConfig,
          account,
          providerLike: provider,
          chainId: documentNetwork?.id || null,
          tags,
        });
        if (!isCurrentUploadContext()) return;
        const txId = toStr(result?.txId).trim();
        if (txId) {
          setDocs((prev) => [
            buildPendingDocRecord({
              txId,
              tagMap: result.tagMap || buildTagMapFromTags(tags),
              data: result.data || { size: null, type: 'application/json' },
              storageRef: result.storageRef || null,
            }),
            ...prev,
          ]);
        }
        if (isCurrentUrlUploadAttempt()) {
          setUrlInput('');
          setUrlTitle('');
        }
        return;
      }

      const audience = resolveEncryptAudience();
      if (!audience.ok || !audience.encrypted) {
        throw new Error(
          audience.ok ? 'Encryption audience unavailable.' : audience.error || 'Encryption audience unavailable.',
        );
      }

      const result = await uploadDocLibraryUrlRecordUntyped({
        url,
        title: urlTitle,
        sessionSlug,
        sessionConfig,
        account,
        providerLike: provider,
        chainId: documentNetwork?.id || null,
        tags,
        encryption: {
          enabled: true,
          saveKey: audience.litHooks.saveKey,
          accessControlConditions: audience.accessControlConditions,
          litChain: audience.litChain,
          chainId: audience.chainId,
          ...(audience.litHooks.litNetwork ? { litNetwork: audience.litHooks.litNetwork } : {}),
          ...(audience.litHooks.connectTimeout ? { connectTimeout: audience.litHooks.connectTimeout } : {}),
          ...(audience.litHooks.providerLike ? { providerLike: audience.litHooks.providerLike } : {}),
          ...(audience.litHooks.resourceAbilityRequests
            ? { resourceAbilityRequests: audience.litHooks.resourceAbilityRequests }
            : {}),
          contextLabel: `doc-link:${sessionSlug || ''}`,
        },
      });
      if (!isCurrentUploadContext()) return;

      const txId = toStr(result?.txId).trim();
      if (txId) {
        setDocs((prev) => [
          buildPendingDocRecord({
            txId,
            tagMap: result.tagMap || buildTagMapFromTags(tags),
            data: result.data || { size: null, type: 'application/json' },
            storageRef: result.storageRef || null,
          }),
          ...prev,
        ]);
      }
      if (isCurrentUrlUploadAttempt()) {
        setUrlInput('');
        setUrlTitle('');
      }
    } catch (err) {
      if (isCurrentUrlUploadAttempt()) {
        setError(getErrorMessage(err, 'Upload failed.'));
      }
    } finally {
      if (isCurrentUploadAttemptSeq() && isCurrentUploadContext()) {
        urlUploadInFlightRef.current = false;
        setUrlUploadPending(false);
      }
    }
  }, [
    docProvider,
    documentUploadBlockedMessage,
    isArweaveBackedDocProvider,
    isUploadableDocProvider,
    requiresLitDocumentStorage,
    urlInput,
    urlTitle,
    loginComplete,
    toggleLoginModal,
    effectiveLocked,
    provider,
    account,
    documentNetwork?.id,
    sessionSlug,
    sessionConfig,
    resolveAssociationTags,
    resolveEncryptAudience,
    mode,
    normalizedSessionIdHex,
    normalizedSbtAddress,
    sbtChainId,
  ]);

  return (
    <div className={compact ? `${styles.panel} ${styles.compact}` : styles.panel} data-testid={E2E_TESTIDS.DOC_PANEL}>
      <div className={styles.header}>
        <div className={styles.title} data-testid={E2E_TESTIDS.DOC_TITLE}>
          Doc Library
        </div>
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

      {!isUploadableDocProvider && (
        <div className={styles.notice}>
          Doc library provider <code>{docProvider}</code> is not implemented yet for listing/upload.
        </div>
      )}

      {documentUploadBlockedMessage && <div className={styles.notice}>{documentUploadBlockedMessage}</div>}
      {documentCapabilityNotice && <div className={styles.notice}>{documentCapabilityNotice}</div>}

      {isArweaveBackedDocProvider && mode === 'session' && !normalizedSessionIdHex && (
        <div className={styles.notice}>
          Session ID is unavailable for this session. Session docs are indexed by <code>sessionIdHex</code>, so
          listing/upload is disabled.
        </div>
      )}

      {isArweaveBackedDocProvider &&
        mode === 'sbt' &&
        (!normalizedSbtAddress || !Number(sbtChainId || documentNetwork?.id || 0)) && (
          <div className={styles.notice}>
            Missing SBT association (chainId + address). Group docs listing/upload is disabled.
          </div>
        )}

      {!!error && <div className={styles.error}>{error}</div>}

      {showUploadControls ? (
        <DocumentLibraryUploadControls
          file={file}
          onFileChange={setFile}
          onUploadFile={uploadFile}
          fileUploadPending={fileUploadPending}
          urlInput={urlInput}
          onUrlInputChange={setUrlInput}
          urlTitle={urlTitle}
          onUrlTitleChange={setUrlTitle}
          onUploadUrlRecord={uploadUrlRecord}
          urlUploadPending={urlUploadPending}
          isUploadableDocProvider={canUploadDocuments}
          showEncryptionControls={allowsLitDocumentControls}
          showSbtAudienceControls={allowsSbtDocumentControls}
          requiresLitDocumentStorage={requiresLitDocumentStorage}
          locked={effectiveLocked}
          onToggleLocked={toggleLocked}
          sessionGateUnsupportedMessage={sessionGateUnsupportedMessage}
          audienceMode={audienceMode}
          onAudienceModeChange={(nextMode) => {
            userEncryptionOverrideRef.current = true;
            setAudienceMode(nextMode);
          }}
          docUploadsGate={docUploadsGate}
          customSbtList={customSbtList}
          addCustomSbt={addCustomSbt}
          removeCustomSbt={removeCustomSbt}
          customGateMode={customGateMode}
          onCustomGateModeChange={setCustomGateMode}
          network={documentNetwork}
          sessionSlug={sessionSlug}
          mode={mode}
          secondaryAssociationType={secondaryAssociationType}
          alsoAssociateSbt={alsoAssociateSbt}
          onAlsoAssociateSbtChange={setAlsoAssociateSbt}
          assocSbtChainId={assocSbtChainId}
          onAssocSbtChainIdChange={setAssocSbtChainId}
          assocSbtAddress={assocSbtAddress}
          onAssocSbtAddressChange={setAssocSbtAddress}
          alsoAssociateSession={alsoAssociateSession}
          onAlsoAssociateSessionChange={setAlsoAssociateSession}
          normalizedSecondarySessionIdHex={normalizedSecondarySessionIdHex}
        />
      ) : null}

      <DocumentLibraryList
        docs={docs}
        loading={loading}
        canList={canList}
        cursor={cursor}
        onLoadMore={() => loadDocs({ reset: false })}
        openDoc={openDoc}
        provider={provider}
        account={account}
        network={documentNetwork}
        panelContextKey={panelContextKey}
        litHooks={allowsLitDocumentControls ? scopedLitHooks : null}
      />

      <Modal isOpen={viewerOpen} toggle={closeViewer} size="lg" centered data-testid={E2E_TESTIDS.DOC_VIEWER}>
        <ModalHeader toggle={closeViewer} data-testid={E2E_TESTIDS.DOC_VIEWER_TITLE}>
          {viewerTitle || 'Document'}
        </ModalHeader>
        <ModalBody>
          <DocumentLibraryViewerBody
            viewerError={viewerError}
            viewerLoading={viewerLoading}
            viewerText={viewerText}
            viewerMime={viewerMime}
            viewerBlobUrl={viewerBlobUrl}
            viewerTitle={viewerTitle}
          />
        </ModalBody>
      </Modal>
    </div>
  );
}
