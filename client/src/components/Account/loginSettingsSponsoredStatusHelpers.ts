type SponsoredStatusEntry = Record<string, unknown> & {
  status?: string;
};

type SponsorSessionDisplayEntry = Record<string, unknown> & {
  isActive?: boolean;
  label?: string;
};

type SponsoredAccessRecord = Record<string, SponsoredStatusEntry | null | undefined>;
type SponsoredKeysRecord = Record<string, unknown>;
type SponsorSessionsRecord = Record<string, unknown> & {
  byResource?: Record<string, readonly SponsorSessionDisplayEntry[]>;
};

type SponsorshipCardArgs = {
  activeSession?: unknown;
  key: string;
  sponsoredAccess?: SponsoredAccessRecord;
  sponsorSessions?: SponsorSessionsRecord;
  title: string;
};

type ResourceSponsorHintArgs = {
  resourceKey?: string;
  resourceLabel?: string;
  sponsoredKeys?: SponsoredKeysRecord;
  sponsorSessions?: SponsorSessionsRecord;
};

const SETTINGS_SPONSORSHIP_RESOURCES = Object.freeze([
  { key: 'ai', title: 'AI' },
  { key: 'arweave', title: 'Arweave' },
  { key: 'rpc', title: 'RPC' },
  { key: 'txGas', title: 'Tx gas' },
]);

export const getSponsoredKeyAliases = (resourceKey: string = ''): string[] => {
  if (resourceKey === 'txGas') return ['faucet', 'txGas'];
  return [resourceKey];
};

export const formatSponsoredStatusMeta = (
  entry: SponsoredStatusEntry | null = null,
  hasActiveSponsor: boolean = false,
) => {
  const status = entry?.status === 'unresolved' ? 'error' : entry?.status || 'no-gate';
  if (!hasActiveSponsor) {
    return { label: 'Not sponsored', tone: 'muted', detail: 'No sponsor key is configured for the active session.' };
  }
  if (status === 'granted') {
    return { label: 'Gate unlocked', tone: 'ok', detail: 'Sponsored key is available for the active session.' };
  }
  if (status === 'denied') {
    return {
      label: 'Gate locked',
      tone: 'warn',
      detail: 'Sponsored key exists, but this wallet does not satisfy the SBT gate.',
    };
  }
  if (status === 'needs-wallet') {
    return {
      label: 'Connect wallet',
      tone: 'warn',
      detail: 'Connect a wallet to evaluate the sponsor gate for this session.',
    };
  }
  if (status === 'invalid-gate') {
    return { label: 'Invalid gate', tone: 'warn', detail: 'This sponsor gate configuration is incomplete.' };
  }
  if (status === 'unknown' || status === 'error') {
    return {
      label: 'Check unavailable',
      tone: 'muted',
      detail: 'We could not confirm gate access for the active-session sponsor.',
    };
  }
  if (status === 'no-gate' && hasActiveSponsor) {
    return { label: 'Sponsored', tone: 'ok', detail: 'A sponsor key is configured and does not require an SBT gate.' };
  }
  return { label: 'Not sponsored', tone: 'muted', detail: 'No sponsor key is configured for the active session.' };
};

export const buildLoginSettingsSponsorshipCard = ({
  activeSession = null,
  key,
  sponsoredAccess = {},
  sponsorSessions = {},
  title,
}: SponsorshipCardArgs) => {
  const sessions = sponsorSessions.byResource?.[key] || [];
  const activeSponsorSession = sessions.find((entry) => entry?.isActive) || null;
  const otherSponsorSessions = sessions.filter((entry) => !entry?.isActive);
  const access = sponsoredAccess[key] || null;
  return {
    key,
    title,
    status: formatSponsoredStatusMeta(access, !!activeSponsorSession),
    access,
    activeSession,
    activeSponsorSession,
    otherSponsorSessions,
    sessions,
  };
};

export const buildLoginSettingsSponsorshipCards = ({
  activeSession = null,
  sponsoredAccess = {},
  sponsorSessions = {},
}: {
  activeSession?: unknown;
  sponsoredAccess?: SponsoredAccessRecord;
  sponsorSessions?: SponsorSessionsRecord;
} = {}) =>
  SETTINGS_SPONSORSHIP_RESOURCES.map(({ key, title }) =>
    buildLoginSettingsSponsorshipCard({
      activeSession,
      key,
      sponsoredAccess,
      sponsorSessions,
      title,
    }),
  );

export const formatResourceSponsorHint = ({
  resourceKey = '',
  resourceLabel = '',
  sponsoredKeys = {},
  sponsorSessions = {},
}: ResourceSponsorHintArgs = {}) => {
  const label = resourceLabel || resourceKey || 'resource';
  const activeHasSponsor = getSponsoredKeyAliases(resourceKey).some((alias) => !!sponsoredKeys?.[alias]);
  const otherSessions = (sponsorSessions?.byResource?.[resourceKey] || []).filter((entry) => !entry?.isActive);
  if (activeHasSponsor) {
    if (!otherSessions.length) {
      return `${label} sponsor is configured for the active session.`;
    }
    return `${label} sponsor is configured for the active session. Other sessions also sponsor ${label}: ${otherSessions.map((entry) => entry.label).join(', ')}.`;
  }
  if (otherSessions.length) {
    return `No active-session ${label} sponsor. Other sessions with ${label}: ${otherSessions.map((entry) => entry.label).join(', ')}. Switch sessions to use one.`;
  }
  return `No active-session ${label} sponsor configured.`;
};
