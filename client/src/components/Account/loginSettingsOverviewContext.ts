import type {
  SessionCapabilityProjection,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import { isCryptoMode } from '../../utilities/ui/terminology.js';
import { buildLoginSettingsSponsorshipCards, type SponsoredAccessRecord } from './loginSettingsSponsoredStatusHelpers';

type SettingsSessionDescriptor = Record<string, unknown> & {
  label: string;
};

type SponsoredSessionEntry = Record<string, unknown> & {
  slug: string;
  label: string;
  sponsoredKeys: Record<string, unknown>;
  isActive?: boolean;
  inRpcScope?: boolean;
};

export type SponsoredSessionSources = {
  byResource: Record<string, SponsoredSessionEntry[]>;
  rpcScope: SponsoredSessionEntry[];
};

export type LoginSettingsOverviewContext = {
  activeSession: SettingsSessionDescriptor;
  cryptoTerminology: boolean;
  needsNetworkSwitch: boolean;
  showWalletNetwork: boolean;
  sponsorshipCards: ReturnType<typeof buildLoginSettingsSponsorshipCards>;
  sponsorSessions: SponsoredSessionSources;
  targetNetworkName: string;
  targetNetwork: unknown;
  walletNetworkName: string;
  capabilities: SessionCapabilityProjection;
};

type LoginSettingsOverviewHost = {
  props: {
    provider: string;
    wagmiNetwork?: any;
    network?: any;
    loginComplete: boolean;
    selectedSessionScope?: unknown;
    selectedSessionSlugs?: unknown[];
  };
  state: {
    sponsoredAccess?: SponsoredAccessRecord;
    sessionScanSlugs: string[];
    sessionScanSlugsInput: string;
  };
  _sessionCapabilityProjectionResolver: typeof resolveSessionCapabilityProjection | null;
  _settingsOverviewMemo: { key: string; value: LoginSettingsOverviewContext } | null;
  getActiveSessionSlug: () => string;
  getDisplaySessionConfig: (slug: string) => any;
  getTargetNetwork: () => any;
  getSessionDescriptor: (slug: string, config: any) => SettingsSessionDescriptor;
  getSponsoredSessionSources: (args: { activeSlug: string }) => SponsoredSessionSources;
  getSessionScanScopeValue: () => string;
};

const FAIL_CLOSED_SESSION_CAPABILITIES = Object.freeze({
  source: 'missing',
  profileValid: false,
  authorityMode: '',
  isWorkerCanonical: false,
  isRegistryCanonical: false,
  usesWorkerAuthority: false,
  usesPasskeyIdentity: false,
  usesWorkerGroups: false,
  usesArweave: false,
  usesLit: false,
  usesOnChainSbt: false,
  usesRpc: false,
  usesFunding: false,
  usesChainMetadata: false,
  hasTranscription: false,
  gateKind: 'session',
  showNetworkControls: false,
  settingsResourceKeys: ['ai'],
  adminSecretCardKeys: ['ai'],
  adminTestKeys: ['health', 'ai'],
} as SessionCapabilityProjection);

export const getLoginSettingsOverviewContext = (host: LoginSettingsOverviewHost): LoginSettingsOverviewContext => {
  const sessionSlug = host.getActiveSessionSlug();
  const sessionConfig = host.getDisplaySessionConfig(sessionSlug);
  const capabilities = host._sessionCapabilityProjectionResolver?.(sessionConfig) || FAIL_CLOSED_SESSION_CAPABILITIES;
  const walletNet = host.props.provider === 'wagmi' ? host.props.wagmiNetwork : host.props.network;
  const targetNetwork = host.getTargetNetwork();
  const targetNetworkName = targetNetwork?.name || 'not configured';
  const walletNetworkName = walletNet?.name || 'not connected';
  const targetId = Number(targetNetwork.id);
  const needsNetworkSwitch =
    capabilities.showNetworkControls &&
    host.props.provider === 'wagmi' &&
    walletNet?.id !== targetId &&
    host.props.loginComplete;
  const showWalletNetwork =
    capabilities.showNetworkControls && host.props.provider === 'wagmi' && !!walletNet && walletNet.id !== targetId;
  const activeSession = host.getSessionDescriptor(sessionSlug, sessionConfig);
  const sponsoredAccess = host.state.sponsoredAccess || {};
  const sponsorSessions = host.getSponsoredSessionSources({ activeSlug: sessionSlug });
  const memoKey = JSON.stringify({
    activeSession,
    loginComplete: host.props.loginComplete,
    provider: host.props.provider,
    selectedSessionScope: host.props.selectedSessionScope,
    selectedSessionSlugs: host.props.selectedSessionSlugs || [],
    sessionScanScope: host.getSessionScanScopeValue(),
    sessionScanSlugs: host.state.sessionScanSlugs,
    sessionScanSlugsInput: host.state.sessionScanSlugsInput,
    sponsoredAccess,
    sponsorSessions,
    capabilities,
    targetNetworkId: targetNetwork?.id,
    targetNetworkName,
    walletNetworkId: walletNet?.id,
    walletNetworkName,
  });
  if (host._settingsOverviewMemo?.key === memoKey) return host._settingsOverviewMemo.value;

  const value: LoginSettingsOverviewContext = {
    activeSession,
    cryptoTerminology: isCryptoMode(),
    needsNetworkSwitch,
    showWalletNetwork,
    sponsorshipCards: buildLoginSettingsSponsorshipCards({
      activeSession,
      sponsoredAccess,
      sponsorSessions,
      resourceKeys: capabilities.settingsResourceKeys,
      gateKind: capabilities.gateKind,
    }),
    sponsorSessions,
    targetNetworkName,
    targetNetwork,
    walletNetworkName,
    capabilities,
  };
  host._settingsOverviewMemo = { key: memoKey, value };
  return value;
};
