import {
  formatSponsoredStatusMeta,
  getSponsoredKeyAliases,
} from './loginSettingsSponsoredStatusHelpers';

describe('loginSettingsSponsoredStatusHelpers', () => {
  it('keeps resource alias mapping for faucet-backed test gas sponsorship', () => {
    expect(getSponsoredKeyAliases('txGas')).toEqual(['faucet', 'txGas']);
    expect(getSponsoredKeyAliases('ai')).toEqual(['ai']);
    expect(getSponsoredKeyAliases()).toEqual(['']);
  });

  it('formats active-session sponsor status labels without changing fallback semantics', () => {
    expect(formatSponsoredStatusMeta({ status: 'granted' }, false)).toEqual({
      label: 'Not sponsored',
      tone: 'muted',
      detail: 'No sponsor key is configured for the active session.',
    });
    expect(formatSponsoredStatusMeta({ status: 'granted' }, true)).toEqual({
      label: 'Gate unlocked',
      tone: 'ok',
      detail: 'Sponsored key is available for the active session.',
    });
    expect(formatSponsoredStatusMeta({ status: 'denied' }, true)).toEqual({
      label: 'Gate locked',
      tone: 'warn',
      detail: 'Sponsored key exists, but this wallet does not satisfy the SBT gate.',
    });
    expect(formatSponsoredStatusMeta({ status: 'needs-wallet' }, true)).toEqual({
      label: 'Connect wallet',
      tone: 'warn',
      detail: 'Connect a wallet to evaluate the sponsor gate for this session.',
    });
    expect(formatSponsoredStatusMeta({ status: 'invalid-gate' }, true)).toEqual({
      label: 'Invalid gate',
      tone: 'warn',
      detail: 'This sponsor gate configuration is incomplete.',
    });
    expect(formatSponsoredStatusMeta({ status: 'unresolved' }, true)).toEqual({
      label: 'Check unavailable',
      tone: 'muted',
      detail: 'We could not confirm gate access for the active-session sponsor.',
    });
    expect(formatSponsoredStatusMeta(null, true)).toEqual({
      label: 'Sponsored',
      tone: 'ok',
      detail: 'A sponsor key is configured and does not require an SBT gate.',
    });
  });
});
