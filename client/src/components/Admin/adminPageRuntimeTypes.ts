export type AdminSecrets = Record<string, string>;
export type AdminSecretKeySet = Set<string>;
export type AdminOpenSecretCards = Record<string, boolean>;

export type AdminDecryptedFieldEntry = {
  value?: unknown;
  status?: string;
  encryptedAvailable?: boolean;
  envelope?: unknown;
  [key: string]: unknown;
};

export type AdminDecryptedFieldMap = Record<string, AdminDecryptedFieldEntry>;

export type AdminMetadataBlockLimitsDraft = {
  start: string;
  end: string;
};

export type AdminSessionConfigLike = {
  sessionName?: unknown;
  sessionId?: unknown;
  networkChainId?: unknown;
  __registry?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AdminPageProps = {
  account?: string;
  provider?: string;
  network?: {
    id?: unknown;
    chainId?: unknown;
  } | null;
  toggleLoginModal?: (payload?: unknown) => unknown;
  loginComplete?: boolean;
  ensureLightSbtUniverse?: () => unknown;
  initialSessionId?: unknown;
  initialRegistryChainId?: unknown;
  initialSessionConfig?: unknown;
};

export const asAdminSessionConfig = (value: unknown): AdminSessionConfigLike =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AdminSessionConfigLike) : {};
