type SponsoredStatusEntry = Record<string, any> & {
  status?: string;
};

export const getSponsoredKeyAliases = (resourceKey: string = ''): string[] => {
  if (resourceKey === 'txGas') return ['faucet', 'txGas'];
  return [resourceKey];
};

export const formatSponsoredStatusMeta = (
  entry: SponsoredStatusEntry | null = null,
  hasActiveSponsor: boolean = false
) => {
  const status = entry?.status === 'unresolved'
    ? 'error'
    : (entry?.status || 'no-gate');
  if (!hasActiveSponsor) {
    return { label: 'Not sponsored', tone: 'muted', detail: 'No sponsor key is configured for the active session.' };
  }
  if (status === 'granted') {
    return { label: 'Gate unlocked', tone: 'ok', detail: 'Sponsored key is available for the active session.' };
  }
  if (status === 'denied') {
    return { label: 'Gate locked', tone: 'warn', detail: 'Sponsored key exists, but this wallet does not satisfy the SBT gate.' };
  }
  if (status === 'needs-wallet') {
    return { label: 'Connect wallet', tone: 'warn', detail: 'Connect a wallet to evaluate the sponsor gate for this session.' };
  }
  if (status === 'invalid-gate') {
    return { label: 'Invalid gate', tone: 'warn', detail: 'This sponsor gate configuration is incomplete.' };
  }
  if (status === 'unknown' || status === 'error') {
    return { label: 'Check unavailable', tone: 'muted', detail: 'We could not confirm gate access for the active-session sponsor.' };
  }
  if (status === 'no-gate' && hasActiveSponsor) {
    return { label: 'Sponsored', tone: 'ok', detail: 'A sponsor key is configured and does not require an SBT gate.' };
  }
  return { label: 'Not sponsored', tone: 'muted', detail: 'No sponsor key is configured for the active session.' };
};
