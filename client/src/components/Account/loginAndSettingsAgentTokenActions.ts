import type { FormEvent } from 'react';
import type { AgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import {
  cacheAgentClientLoginEnvelope,
  resolveAgentClientLoginIdentityTarget,
  resolveTelegramAgentBridgeUrl,
} from '../OnePageSession/onePageSessionTelegramController';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

export type LoginAgentSessionContext = {
  agentBridgeUrl: string;
  sessionId: string;
  sessionConfig: LoginDisplaySessionConfig;
  sessionSlug: string;
  workerCanonical: boolean;
  workerUrl: string;
};

type AgentClientTokenValidation = { ok: boolean; reason?: string };
type AgentTokenStatePatch =
  | { agentTokenError: string; agentTokenInput: string; agentTokenStatus: string }
  | { agentTokenError: string; agentTokenInput: string; agentTokenLoginOpen: boolean; agentTokenStatus: string };

export type LoginAgentActionsDeps = {
  changeAccount: (payload: unknown) => void;
  exchangeAgentClientLogin: (args: {
    agentBridgeUrl: string;
    sessionId?: unknown;
    sessionSlug: string;
    tokenOrLink: string;
    workerUrl?: unknown;
  }) => Promise<AgentClientLoginEnvelope>;
  extractAgentClientToken: (tokenOrLink: string) => { ok: true } | { ok: false; reason: string };
  getActiveSessionSlug: () => string;
  getAgentTokenInput: () => string;
  getDemoSessionConfigBySlug: (slug: string, options: { allowDemoFallback: boolean }) => unknown;
  getPropSessionConfig: () => unknown;
  getSessionConfigBySlugOrDefault: (slug: string) => unknown;
  getTargetNetwork: () => unknown;
  isTelegramFirstSessionConfig: (sessionConfig: unknown) => boolean;
  normalizeSettingsSessionSlug: (slug: unknown) => string;
  setState: (patch: { agentTokenError?: string; agentTokenInput?: string; agentTokenLoginOpen?: boolean; agentTokenStatus?: string } | ((prev: { agentTokenLoginOpen: boolean }) => { agentTokenError: string; agentTokenInput: string; agentTokenLoginOpen: boolean; agentTokenStatus: string })) => void;
  setStateIfMounted: (patch: { agentTokenError?: string; agentTokenInput?: string; agentTokenStatus?: string }) => void;
  updateLoginInfo: (payload: { loginComplete: boolean; loginInProgress: boolean; provider: string | null }) => void;
  windowTarget?: (Window & typeof globalThis) | null;
};

export type LoginAgentActions = {
  completeAgentClientLogin: (envelope: AgentClientLoginEnvelope) => void;
  formatAgentTokenError: (error: unknown) => string;
  getAgentTokenLoginSessionContext: () => LoginAgentSessionContext;
  getDisplaySessionConfig: (slugIn?: unknown, cfgIn?: unknown) => unknown;
  handleAgentTokenLoginSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resolveAgentBridgeUrl: (sessionConfig?: unknown) => string;
  shouldShowAgentTokenLogin: () => boolean;
  toggleAgentTokenLogin: () => void;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const toRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

export const resolveValidatedWorkerCanonicalLoginConfig = ({
  sessionConfig,
  expectedSlug = '',
  normalizeSessionSlug,
}: {
  sessionConfig: unknown;
  expectedSlug?: unknown;
  normalizeSessionSlug: (slug: unknown) => string;
}): LoginDisplaySessionConfig | null => {
  if (!isRecord(sessionConfig)) return null;
  const configSlug = normalizeSessionSlug(sessionConfig.slug);
  const normalizedExpectedSlug = normalizeSessionSlug(expectedSlug);
  if (!configSlug || (normalizedExpectedSlug && configSlug !== normalizedExpectedSlug)) return null;
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  return projection.profileValid && projection.isWorkerCanonical ? sessionConfig : null;
};

const mergeDisplaySessionConfig = (overlay: UnknownRecord, canonical: UnknownRecord): LoginDisplaySessionConfig => ({
  ...overlay,
  ...canonical,
  sponsoredKeys: {
    ...(isRecord(overlay.sponsoredKeys) ? overlay.sponsoredKeys : {}),
    ...(isRecord(canonical.sponsoredKeys) ? canonical.sponsoredKeys : {}),
  },
  contracts: {
    ...(isRecord(overlay.contracts) ? overlay.contracts : {}),
    ...(isRecord(canonical.contracts) ? canonical.contracts : {}),
  },
});

const toStr = (value: unknown): string => String(value ?? '').trim();

export const formatAgentTokenError = (error: unknown): string => {
  const reason = toStr(isRecord(error) && 'message' in error ? error.message : error);
  if (reason.includes('expired'))
    return 'This token is expired. Create a fresh agent token in Telegram and paste it again.';
  if (reason.includes('session_mismatch')) return 'This token is for a different session.';
  if (reason.includes('session_identity'))
    return 'This session’s exact Worker identity is unavailable. Reload its canonical session configuration and try again.';
  if (reason.includes('scope_denied')) return 'This token does not have permission to unlock the client view.';
  if (reason.includes('origin_denied') || reason.includes('origin_not_allowed'))
    return 'This browser origin is not allowed for this session.';
  if (reason.includes('not_enabled') || reason.includes('disabled'))
    return 'Client token login is not enabled for this session.';
  if (reason.includes('empty')) return 'Paste a Context Engine agent token first.';
  if (reason.includes('multiline')) return 'Paste one raw token on a single line.';
  if (reason.includes('unsupported_format')) return 'Paste the raw ceagt_ token, not a link.';
  return 'Agent token login failed. Create a fresh token in Telegram and try again.';
};

export const createLoginAgentActions = (deps: LoginAgentActionsDeps): LoginAgentActions => {
  const getDisplaySessionConfig = (slugIn: unknown = '', cfgIn: unknown = null): unknown => {
    const cfgRecord = isRecord(cfgIn) ? cfgIn : {};
    const slug = deps.normalizeSettingsSessionSlug(slugIn || cfgRecord.slug || '');
    const propSessionConfig = deps.getPropSessionConfig();
    const propConfigRecord = isRecord(propSessionConfig) ? propSessionConfig : null;
    const propConfigSlug = deps.normalizeSettingsSessionSlug(propConfigRecord?.slug || slug);
    const verifiedWorkerConfig = resolveValidatedWorkerCanonicalLoginConfig({
      sessionConfig: propSessionConfig,
      expectedSlug: slug,
      normalizeSessionSlug: deps.normalizeSettingsSessionSlug,
    });
    if (!cfgIn && verifiedWorkerConfig) return verifiedWorkerConfig;
    if (!cfgIn && propConfigRecord && propConfigSlug === slug) {
      return propConfigRecord;
    }
    return (
      cfgIn ||
        deps.getSessionConfigBySlugOrDefault(slug) ||
        deps.getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) ||
        {},
    );
  };

  const resolveAgentBridgeUrl = (sessionConfig: unknown = null): string => resolveTelegramAgentBridgeUrl(sessionConfig);

  const getAgentTokenLoginSessionContext = (): LoginAgentSessionContext => {
    const sessionSlug = deps.getActiveSessionSlug();
    const sessionConfig = getDisplaySessionConfig(sessionSlug);
    const projection = resolveSessionCapabilityProjection(sessionConfig);
    const identity = resolveAgentClientLoginIdentityTarget({ sessionConfig, sessionSlug });
    return {
      sessionSlug,
      sessionConfig,
      agentBridgeUrl: resolveAgentBridgeUrl(sessionConfig),
      sessionId: toStr(identity.sessionId),
      workerCanonical: projection.isWorkerCanonical,
      workerUrl: toStr(identity.workerUrl),
    };
  };

  const shouldShowAgentTokenLogin = (): boolean => {
    const { sessionSlug, sessionConfig } = getAgentTokenLoginSessionContext();
    if (!sessionSlug) return false;
    return deps.isTelegramFirstSessionConfig(sessionConfig);
  };

  const toggleAgentTokenLogin = (): void => {
    deps.setState((prev) => ({
      agentTokenLoginOpen: !prev.agentTokenLoginOpen,
      agentTokenError: '',
      agentTokenStatus: '',
      agentTokenInput: '',
    }));
  };

  const completeAgentClientLogin = (envelope: AgentClientLoginEnvelope): void => {
    const targetNetwork = deps.getTargetNetwork();
    try {
      cacheAgentClientLoginEnvelope(envelope);
      const windowTarget = deps.windowTarget ?? (typeof window !== 'undefined' ? window : null);
      if (windowTarget && typeof windowTarget.dispatchEvent === 'function') {
        windowTarget.dispatchEvent(
          new CustomEvent('ce-agent-client-login', {
            detail: { sessionSlug: envelope.sessionSlug, envelope },
          }),
        );
      }
    } catch (_) {}
    deps.changeAccount({
      account: envelope.address,
      provider: 'telegram_agent',
      network: targetNetwork,
      userImageURL: undefined,
      agentClientSession: {
        sessionSlug: envelope.sessionSlug,
        expiresAt: envelope.expiresAt,
        capabilities: envelope.capabilities,
      },
    });
    deps.updateLoginInfo({
      loginInProgress: false,
      loginComplete: true,
      provider: 'telegram_agent',
    });
  };

  const handleAgentTokenLoginSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!shouldShowAgentTokenLogin()) return;
    const { sessionSlug, agentBridgeUrl, sessionId, workerCanonical, workerUrl } = getAgentTokenLoginSessionContext();
    const tokenOrLink = deps.getAgentTokenInput();
    const validation = deps.extractAgentClientToken(tokenOrLink);
    deps.setState({
      agentTokenInput: '',
      agentTokenError: validation.ok ? '' : formatAgentTokenError(new Error(validation.reason)),
      agentTokenStatus: validation.ok ? 'loading' : 'error',
    });
    if (!validation.ok) return;
    if (workerCanonical && (!sessionId || !workerUrl)) {
      deps.setStateIfMounted({
        agentTokenInput: '',
        agentTokenStatus: 'error',
        agentTokenError: formatAgentTokenError(new Error('session_identity_missing')),
      });
      return;
    }

    deps.updateLoginInfo({
      loginInProgress: true,
      loginComplete: false,
      provider: 'telegram_agent',
    });

    try {
      const envelope = await deps.exchangeAgentClientLogin({
        agentBridgeUrl,
        sessionId,
        sessionSlug,
        tokenOrLink,
        workerUrl,
      });
      deps.setStateIfMounted({
        agentTokenInput: '',
        agentTokenStatus: 'success',
        agentTokenError: '',
      });
      completeAgentClientLogin(envelope);
    } catch (error) {
      deps.updateLoginInfo({
        loginInProgress: false,
        loginComplete: false,
        provider: null,
      });
      deps.setStateIfMounted({
        agentTokenInput: '',
        agentTokenStatus: 'error',
        agentTokenError: formatAgentTokenError(error),
      });
    }
  };

  return {
    completeAgentClientLogin,
    formatAgentTokenError,
    getAgentTokenLoginSessionContext,
    getDisplaySessionConfig,
    handleAgentTokenLoginSubmit,
    resolveAgentBridgeUrl,
    shouldShowAgentTokenLogin,
    toggleAgentTokenLogin,
  };
};
