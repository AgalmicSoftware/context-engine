import * as contractScripts from '../../utilities/web3/contractScripts.js';

export type SessionConfig = Record<string, unknown> & {
  slug?: string;
  sessionSlug?: string;
};

export type SessionConfigLookupOptions = {
  preferRegistry?: boolean;
  allowDemoFallback?: boolean;
};

export const normalizeSessionSlug = (slug: unknown): string => (
  contractScripts.normalizeSessionSlug(slug)
);

export const getSessionConfigBySlug = (slug: unknown): SessionConfig | null => (
  contractScripts.getSessionConfigBySlug(slug) as SessionConfig | null
);

export const getDemoSessionConfigBySlug = (
  slug: unknown,
  options: SessionConfigLookupOptions = {},
): SessionConfig | null => (
  contractScripts.getDemoSessionConfigBySlug(slug, options) as SessionConfig | null
);

export const getSessionConfigBySlugOrDefault = (slug: unknown): SessionConfig | null => (
  contractScripts.getSessionConfigBySlugOrDefault(slug) as SessionConfig | null
);

export const getAllSessionSlugs = (
  options: { includeEmpty?: boolean } = {},
): string[] => (
  contractScripts.getAllSessionSlugs(options) as string[]
);

export const getSessionChainId = (slug: unknown): number | null => (
  contractScripts.getSessionChainId(slug)
);
