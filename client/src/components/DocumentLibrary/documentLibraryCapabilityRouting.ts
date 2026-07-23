import { resolveDocLibraryProvider } from '../../utilities/docLibrary/config.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { STORAGE_BACKENDS } from '../../utilities/storage/storageRefs.js';
import { toStr } from '../../utilities/shared/primitives.js';

export type PanelMode = 'session' | 'sbt';
export type SecondaryAssociationType = 'sbt' | 'session' | null;
export type NetworkLike = { id?: number | string | null } | null;
export type SessionConfig = Record<string, unknown> | null;

export type LitHooks = {
  getKey?: (...args: unknown[]) => unknown;
  saveKey?: (...args: unknown[]) => Promise<unknown>;
  litNetwork?: string;
  connectTimeout?: unknown;
  providerLike?: unknown;
  resourceAbilityRequests?: unknown;
} | null;

export type DocumentLibraryPanelProps = {
  provider?: unknown;
  network?: NetworkLike;
  account?: string | null;
  litHooks?: LitHooks;
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
  showUploadControls?: boolean;
};

export const resolveDocumentLibraryCapabilityRoute = ({
  mode,
  sessionConfig,
  network,
}: {
  mode: PanelMode;
  sessionConfig?: SessionConfig;
  network?: NetworkLike;
}) => {
  const sessionCapabilities = mode === 'session' ? resolveSessionCapabilityProjection(sessionConfig) : null;
  const usesWorkerCanonicalDocumentStorage =
    mode === 'session' && sessionCapabilities?.profileValid === true && sessionCapabilities.isWorkerCanonical === true;
  const allowsLitDocumentControls =
    mode !== 'session' ||
    sessionCapabilities?.source === 'legacy_registry' ||
    (!usesWorkerCanonicalDocumentStorage &&
      sessionCapabilities?.source === 'profile' &&
      sessionCapabilities.profileValid &&
      (sessionCapabilities.usesLit || sessionCapabilities.usesOnChainSbt));
  const allowsSbtDocumentControls =
    mode !== 'session' ||
    sessionCapabilities?.source === 'legacy_registry' ||
    (!usesWorkerCanonicalDocumentStorage &&
      sessionCapabilities?.source === 'profile' &&
      sessionCapabilities.profileValid &&
      sessionCapabilities.usesOnChainSbt);
  const documentUploadBlockedMessage =
    usesWorkerCanonicalDocumentStorage && sessionCapabilities?.usesLit
      ? 'Lit-encrypted Cloudflare document uploads are not available yet. Upload is disabled for this profile; existing documents remain readable.'
      : '';
  const documentCapabilityNotice =
    usesWorkerCanonicalDocumentStorage && sessionCapabilities?.usesOnChainSbt && !sessionCapabilities.usesLit
      ? 'Advanced SBT access gates do not enable Lit encryption for Worker-stored documents. Uploads use Worker-enforced access.'
      : '';
  const documentNetwork = allowsLitDocumentControls || allowsSbtDocumentControls ? network : null;
  const docProvider = usesWorkerCanonicalDocumentStorage
    ? STORAGE_BACKENDS.CLOUDFLARE
    : toStr(resolveDocLibraryProvider(sessionConfig)).trim().toLowerCase();

  return {
    usesWorkerCanonicalDocumentStorage,
    allowsLitDocumentControls,
    allowsSbtDocumentControls,
    documentUploadBlockedMessage,
    documentCapabilityNotice,
    documentNetwork,
    docProvider,
  };
};

export const resolveDocumentLibraryLitHooks = ({
  allowsLitDocumentControls,
  scopedLitHooks,
  globalLitHooks,
}: {
  allowsLitDocumentControls: boolean;
  scopedLitHooks?: LitHooks;
  globalLitHooks: LitHooks;
}): LitHooks => {
  if (!allowsLitDocumentControls) return null;
  return (scopedLitHooks && typeof scopedLitHooks === 'object' ? scopedLitHooks : null) || globalLitHooks;
};
