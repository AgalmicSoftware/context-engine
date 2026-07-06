import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faExternalLinkAlt,
  faEye,
  faLink,
  faLock,
  faLockOpen,
  faSpinner,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { Button, Input } from 'reactstrap';

import styles from './DocumentLibraryPanel.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { arweaveClient as arweaveScripts } from '../../utilities/arweave/arweaveClient.js';
import { DOC_LIBRARY_DOC_ROLES } from '../../utilities/docLibrary/tags.js';
import { getGlobalLitHooks, litStorage } from '../../utilities/crypto/litProtocol.js';
import {
  STORAGE_BACKENDS,
  normalizeStorageRef,
} from '../../utilities/storage/storageRefs.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { notify } from '../../utilities/ui/notify.js';
import { createLogger } from '../../utilities/logging.js';
import SBTSelector from '../SBTs/SBTSelector';

const log = createLogger('DocumentLibraryPanelViews');

type NetworkLike = { id?: number | string | null } | null;
type SecondaryAssociationType = 'sbt' | 'session' | null;

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

type OpenableDoc = Pick<DocRecord, 'txId' | 'tagMap' | 'storageRef'>;

type CustomSbtEntry = {
  address: string;
  name?: string;
  chainId?: number | string | null;
  [key: string]: unknown;
};

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
  litNetwork?: string;
  connectTimeout?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
} | null;

const normalizeDocStorageRef = normalizeStorageRef as (
  input: unknown,
  opts?: NormalizeStorageRefOptions
) => StorageRef | null;

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

const safeFilename = (name: unknown, fallback = 'document'): string => {
  const raw = toStr(name).trim();
  if (!raw) return fallback;
  return raw.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 180) || fallback;
};

type DocRowImagePreviewProps = {
  txId: string;
  name: string;
  isEncryptedStorage: boolean;
  arweaveUrl: string;
  provider?: unknown;
  account?: string | null;
  chainId?: number | string | null;
  panelContextKey?: string;
  litHooks?: LitHooks;
};

const DocRowImagePreview = ({
  txId,
  name,
  isEncryptedStorage,
  arweaveUrl,
  provider,
  account,
  chainId,
  panelContextKey,
  litHooks: scopedLitHooks,
}: DocRowImagePreviewProps) => {
  const [encryptedPreviewUrl, setEncryptedPreviewUrl] = useState('');

  useEffect(() => {
    if (!isEncryptedStorage) {
      setEncryptedPreviewUrl('');
      return undefined;
    }
    if (!txId) {
      setEncryptedPreviewUrl('');
      return undefined;
    }

    const litHooks = (
      (scopedLitHooks && typeof scopedLitHooks === 'object' ? scopedLitHooks : null) ||
      getGlobalLitHooks()
    ) as LitHooks;
    if (!provider || !toStr(account).trim()) {
      setEncryptedPreviewUrl('');
      return undefined;
    }

    let cancelled = false;
    let objectUrl = '';

    const loadEncryptedPreview = async () => {
      try {
        const { payload } = await litStorage.downloadEncryptedArweaveData({
          url: litStorage.buildLitArweaveUrl(txId),
          providerLike: provider,
          account,
          chainId: chainId || null,
          ...(litHooks && typeof litHooks.getKey === 'function'
            ? { lit: { getKey: litHooks.getKey } }
            : {}),
          arweave: {
            debugContext: {
              category: 'doc_lit_preview',
              caller: 'DocumentLibraryPanel.DocRowImagePreview',
              slug: panelContextKey || '',
              chainId: Number(chainId || 0) || null,
            },
          },
        });

        const blob = litStorage.decodeLitPayloadToBlob(payload);
        if (!blob || !toStr(blob.type).trim().toLowerCase().startsWith('image/')) {
          throw new Error('Encrypted image preview unavailable.');
        }
        if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;

        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          if (objectUrl && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(objectUrl);
          }
          return;
        }
        setEncryptedPreviewUrl(objectUrl);
      } catch (_) {
        if (!cancelled) setEncryptedPreviewUrl('');
      }
    };

    loadEncryptedPreview();

    return () => {
      cancelled = true;
      if (objectUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (e) {
          log.warn('DocumentLibraryPanel: preview cleanup', e);
        }
      }
    };
  }, [account, chainId, isEncryptedStorage, panelContextKey, provider, scopedLitHooks, txId]);

  const previewSrc = isEncryptedStorage ? encryptedPreviewUrl : arweaveUrl;
  if (!previewSrc) return null;

  return (
    <div className={styles.docPreview} data-testid={E2E_TESTIDS.DOC_ROW_IMAGE_PREVIEW}>
      <img
        src={previewSrc}
        alt={`${name || 'Document'} preview`}
        className={styles.docPreviewImage}
      />
    </div>
  );
};

type DocumentLibraryViewerBodyProps = {
  viewerError: string;
  viewerLoading: boolean;
  viewerText: string;
  viewerMime: string;
  viewerBlobUrl: string;
  viewerTitle: string;
};

export const DocumentLibraryViewerBody = ({
  viewerError,
  viewerLoading,
  viewerText,
  viewerMime,
  viewerBlobUrl,
  viewerTitle,
}: DocumentLibraryViewerBodyProps) => {
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

type DocumentLibraryUploadControlsProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onUploadFile: () => void;
  fileUploadPending: boolean;
  urlInput: string;
  onUrlInputChange: (value: string) => void;
  urlTitle: string;
  onUrlTitleChange: (value: string) => void;
  onUploadUrlRecord: () => void;
  urlUploadPending: boolean;
  isUploadableDocProvider: boolean;
  requiresLitDocumentStorage: boolean;
  locked: boolean;
  onToggleLocked: () => void;
  sessionGateUnsupportedMessage: string;
  audienceMode: string;
  onAudienceModeChange: (mode: string) => void;
  docUploadsGate: DocUploadsGateState;
  customSbtList: CustomSbtEntry[];
  addCustomSbt: (sbt: CustomSbtEntry) => void;
  removeCustomSbt: (addr: string) => void;
  customGateMode: string;
  onCustomGateModeChange: (mode: string) => void;
  network?: NetworkLike;
  sessionSlug?: string;
  mode: string;
  secondaryAssociationType: SecondaryAssociationType;
  alsoAssociateSbt: boolean;
  onAlsoAssociateSbtChange: (checked: boolean) => void;
  assocSbtChainId: number | string;
  onAssocSbtChainIdChange: (value: string) => void;
  assocSbtAddress: string;
  onAssocSbtAddressChange: (value: string) => void;
  alsoAssociateSession: boolean;
  onAlsoAssociateSessionChange: (checked: boolean) => void;
  normalizedSecondarySessionIdHex: string;
};

export const DocumentLibraryUploadControls = ({
  file,
  onFileChange,
  onUploadFile,
  fileUploadPending,
  urlInput,
  onUrlInputChange,
  urlTitle,
  onUrlTitleChange,
  onUploadUrlRecord,
  urlUploadPending,
  isUploadableDocProvider,
  requiresLitDocumentStorage,
  locked,
  onToggleLocked,
  sessionGateUnsupportedMessage,
  audienceMode,
  onAudienceModeChange,
  docUploadsGate,
  customSbtList,
  addCustomSbt,
  removeCustomSbt,
  customGateMode,
  onCustomGateModeChange,
  network,
  sessionSlug,
  mode,
  secondaryAssociationType,
  alsoAssociateSbt,
  onAlsoAssociateSbtChange,
  assocSbtChainId,
  onAssocSbtChainIdChange,
  assocSbtAddress,
  onAssocSbtAddressChange,
  alsoAssociateSession,
  onAlsoAssociateSessionChange,
  normalizedSecondarySessionIdHex,
}: DocumentLibraryUploadControlsProps) => (
  <div className={styles.uploadBox}>
    <div className={styles.uploadRow}>
      <div className={styles.uploadLabel}>File</div>
      <input
        type="file"
        className={styles.fileInput}
        data-testid={E2E_TESTIDS.DOC_UPLOAD_FILE_INPUT}
        onChange={(e) => onFileChange(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
      />
      <Button
        type="button"
        color="primary"
        size="sm"
        className={styles.primaryBtn}
        onClick={onUploadFile}
        disabled={!file || !isUploadableDocProvider || fileUploadPending}
        aria-busy={fileUploadPending || undefined}
        data-testid={E2E_TESTIDS.DOC_UPLOAD_FILE_BUTTON}
      >
        <FontAwesomeIcon icon={fileUploadPending ? faSpinner : faUpload} spin={fileUploadPending} /> {fileUploadPending ? 'Uploading' : 'Upload'}
      </Button>
    </div>

    <div className={styles.uploadRow}>
      <div className={styles.uploadLabel}>
        URL
      </div>
      <Input
        type="url"
        value={urlInput}
        onChange={(e) => onUrlInputChange(e.target.value)}
        placeholder="Add URL (stored as a link record, not fetched)"
        className={styles.urlField}
        data-testid={E2E_TESTIDS.DOC_URL_INPUT}
      />
      <Button
        type="button"
        color="primary"
        size="sm"
        className={styles.primaryBtn}
        onClick={onUploadUrlRecord}
        disabled={!toStr(urlInput).trim() || !isUploadableDocProvider || urlUploadPending}
        aria-busy={urlUploadPending || undefined}
        title="Upload link record"
        data-testid={E2E_TESTIDS.DOC_URL_ADD_BUTTON}
      >
        <FontAwesomeIcon icon={urlUploadPending ? faSpinner : faLink} spin={urlUploadPending} /> {urlUploadPending ? 'Adding' : 'Add'}
      </Button>
    </div>

    <div className={styles.uploadRow}>
      <div className={styles.uploadLabel} />
      <Input
        type="text"
        value={urlTitle}
        onChange={(e) => onUrlTitleChange(e.target.value)}
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
          onClick={onToggleLocked}
          disabled={requiresLitDocumentStorage}
          title={requiresLitDocumentStorage ? 'Lit-Arweave session storage requires encrypted uploads' : (locked ? 'Upload plaintext' : 'Encrypt with Lit')}
          data-testid={E2E_TESTIDS.DOC_LOCK_TOGGLE}
          data-ce-locked={locked ? 'true' : 'false'}
        >
          <FontAwesomeIcon icon={locked ? faLock : faLockOpen} />
          <span className={styles.lockLabel}>{locked ? 'Locked (Encrypted)' : 'Unlocked (Plaintext)'}</span>
        </button>
      </div>

      {sessionGateUnsupportedMessage ? (
        <div className={styles.noticeInline}>
          {sessionGateUnsupportedMessage}
        </div>
      ) : null}

      {locked && (
        <div className={styles.encryptControls}>
          <div className={styles.audienceRow}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="audienceMode"
                checked={audienceMode === 'sessionGate'}
                onChange={() => onAudienceModeChange('sessionGate')}
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
                onChange={() => onAudienceModeChange('custom')}
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
                    onChange={() => onCustomGateModeChange('any')}
                    data-testid={E2E_TESTIDS.DOC_CUSTOM_MODE_ANY}
                  />
                  Any
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="customGateMode"
                    checked={customGateMode === 'all'}
                    onChange={() => onCustomGateModeChange('all')}
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
          <input type="checkbox" checked={alsoAssociateSbt} onChange={(e) => onAlsoAssociateSbtChange(e.target.checked)} />
          Also associate with SBT group
        </label>
        {alsoAssociateSbt && (
          <div className={styles.secondaryRow}>
            <Input
              type="number"
              value={assocSbtChainId}
              onChange={(e) => onAssocSbtChainIdChange(e.target.value)}
              placeholder="chainId"
              className={styles.secondaryField}
            />
            <Input
              type="text"
              value={assocSbtAddress}
              onChange={(e) => onAssocSbtAddressChange(e.target.value)}
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
            onChange={(e) => onAlsoAssociateSessionChange(e.target.checked)}
            disabled={!normalizedSecondarySessionIdHex}
          />
          Also associate with session
          {!normalizedSecondarySessionIdHex && <span className={styles.muted}> (sessionId unavailable)</span>}
        </label>
      </div>
    )}
  </div>
);

type DocumentLibraryListProps = {
  docs: DocRecord[];
  loading: boolean;
  canList: boolean;
  cursor: string | null;
  onLoadMore: () => void;
  openDoc: (doc: OpenableDoc) => void;
  provider?: unknown;
  account?: string | null;
  network?: NetworkLike;
  panelContextKey?: string;
  litHooks?: LitHooks;
};

export const DocumentLibraryList = ({
  docs,
  loading,
  canList,
  cursor,
  onLoadMore,
  openDoc,
  provider,
  account,
  network,
  panelContextKey,
  litHooks,
}: DocumentLibraryListProps) => (
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
      const storageRef = normalizeDocStorageRef(doc?.storageRef || { backend: storage, id: txId }, { fallbackBackend: storage || STORAGE_BACKENDS.ARWEAVE });
      const isCloudflareStorage = storageRef?.backend === STORAGE_BACKENDS.CLOUDFLARE;
      const arweaveUrl = txId && !isCloudflareStorage ? arweaveScripts.buildArweaveGatewayUrl(txId) : '';
      const litUrl = txId && !isCloudflareStorage ? litStorage.buildLitArweaveUrl(txId) : '';
      const storageUrl = isCloudflareStorage ? toStr(storageRef?.uri).trim() : (isEncryptedStorage ? litUrl : arweaveUrl);
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
          <div className={styles.docSummary}>
            {isImageDoc && !isCloudflareStorage ? (
              <DocRowImagePreview
                txId={txId}
                name={name}
                isEncryptedStorage={isEncryptedStorage}
                arweaveUrl={arweaveUrl}
                provider={provider}
                account={account}
                chainId={network?.id || null}
                panelContextKey={panelContextKey}
                litHooks={litHooks}
              />
            ) : null}
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
            <button type="button" className={styles.iconBtn} onClick={() => copyToClipboard(storageUrl)} title="Copy link">
              <FontAwesomeIcon icon={faCopy} />
            </button>
            {arweaveUrl ? (
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
            ) : null}
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
          onClick={onLoadMore}
          disabled={loading || !cursor}
        >
          Load more
        </Button>
      </div>
    )}
  </div>
);
