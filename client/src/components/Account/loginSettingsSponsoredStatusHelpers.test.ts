import {
  buildLoginSettingsSponsorshipCard,
  buildLoginSettingsSponsorshipCards,
  formatSponsoredStatusMeta,
  formatResourceSponsorHint,
  getSponsoredKeyAliases,
  mergeWorkerResourcePresenceIntoSponsoredKeys,
} from './loginSettingsSponsoredStatusHelpers';

describe('loginSettingsSponsoredStatusHelpers', () => {
  it('keeps resource alias mapping for faucet-backed test gas sponsorship', () => {
    expect(getSponsoredKeyAliases('txGas')).toEqual(['faucet', 'txGas']);
    expect(getSponsoredKeyAliases('ai')).toEqual(['ai']);
    expect(getSponsoredKeyAliases()).toEqual(['']);
  });

  it('uses selected-worker presence as operational truth without mutating registry keys', () => {
    const registryKeys = { ai: true, faucet: true };
    expect(
      mergeWorkerResourcePresenceIntoSponsoredKeys(registryKeys, {
        ai: true,
        arweave: true,
        rpc: true,
        txGas: false,
      }),
    ).toEqual({ ai: true, arweave: true, rpc: true });
    expect(registryKeys).toEqual({ ai: true, faucet: true });
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

  it('builds sponsored resource card display models without reordering sessions', () => {
    const activeSession = { slug: 'active', label: 'Active session' };
    const activeSponsorSession = { slug: 'active', label: 'Active session', isActive: true };
    const otherSponsorSession = { slug: 'other', label: 'Other session', isActive: false };
    const sponsorSessions = {
      byResource: {
        rpc: [otherSponsorSession, activeSponsorSession],
      },
    };
    const sponsoredAccess = {
      rpc: { status: 'granted' },
    };

    expect(
      buildLoginSettingsSponsorshipCard({
        activeSession,
        key: 'rpc',
        sponsoredAccess,
        sponsorSessions,
        title: 'RPC',
      }),
    ).toEqual({
      key: 'rpc',
      title: 'RPC',
      status: {
        label: 'Gate unlocked',
        tone: 'ok',
        detail: 'Sponsored key is available for the active session.',
      },
      access: sponsoredAccess.rpc,
      activeSession,
      activeSponsorSession,
      otherSponsorSessions: [otherSponsorSession],
      sessions: sponsorSessions.byResource.rpc,
    });
  });

  it('does not mark active session sponsored from another session sponsor access result', () => {
    const activeSession = { slug: 'active', label: 'Active session' };
    const otherSponsorSession = { slug: 'other', label: 'Other session', isActive: false };
    const card = buildLoginSettingsSponsorshipCard({
      activeSession,
      key: 'rpc',
      sponsoredAccess: {
        rpc: { status: 'granted' },
      },
      sponsorSessions: {
        byResource: {
          rpc: [otherSponsorSession],
        },
      },
      title: 'RPC',
    });

    expect(card.status).toEqual({
      label: 'Not sponsored',
      tone: 'muted',
      detail: 'No sponsor key is configured for the active session.',
    });
    expect(card.activeSponsorSession).toBeNull();
    expect(card.otherSponsorSessions).toEqual([otherSponsorSession]);
  });

  it('builds settings sponsorship cards in the existing resource order', () => {
    const cards = buildLoginSettingsSponsorshipCards({
      activeSession: { slug: '', label: 'General' },
      sponsorSessions: {
        byResource: {
          ai: [{ slug: '', label: 'General', isActive: true }],
          txGas: [{ slug: 'funding', label: 'Funding', isActive: false }],
        },
      },
      sponsoredAccess: {
        ai: { status: 'granted' },
      },
    });

    expect(cards.map((card) => [card.key, card.title])).toEqual([
      ['ai', 'AI'],
      ['arweave', 'Arweave'],
      ['rpc', 'RPC'],
      ['txGas', 'Tx gas'],
    ]);
    expect(cards[0].status.label).toBe('Gate unlocked');
    expect(cards[3].status.label).toBe('Not sponsored');
    expect(cards[3].otherSponsorSessions.map((entry: any) => entry.label)).toEqual(['Funding']);
  });

  it('formats resource sponsor hints without changing active and other-session fallbacks', () => {
    const sponsorSessions = {
      byResource: {
        rpc: [
          { slug: 'active', label: 'Active', isActive: true },
          { slug: 'backup', label: 'Backup', isActive: false },
        ],
        arweave: [{ slug: 'archive', label: 'Archive', isActive: false }],
      },
    };

    expect(
      formatResourceSponsorHint({
        resourceKey: 'rpc',
        resourceLabel: 'RPC',
        sponsoredKeys: { rpc: 'key' },
        sponsorSessions,
      }),
    ).toBe('RPC sponsor is configured for the active session. Other sessions also sponsor RPC: Backup.');
    expect(
      formatResourceSponsorHint({
        resourceKey: 'arweave',
        resourceLabel: 'Arweave',
        sponsoredKeys: {},
        sponsorSessions,
      }),
    ).toBe('No active-session Arweave sponsor. Other sessions with Arweave: Archive. Switch sessions to use one.');
    expect(
      formatResourceSponsorHint({
        resourceKey: 'ai',
        resourceLabel: 'AI',
        sponsoredKeys: {},
        sponsorSessions,
      }),
    ).toBe('No active-session AI sponsor configured.');
  });
});
