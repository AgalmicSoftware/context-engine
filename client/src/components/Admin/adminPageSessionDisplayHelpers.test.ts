import {
  areAdminEncryptedEntriesEquivalent,
  buildAdminChainRegistryDisplay,
  buildAdminEncryptedEntrySignature,
  buildAdminPageSessionIdentityKey,
  buildSessionUrl,
  collectEncryptedEntries,
  getAdminSessionDisplayUrl,
  shortAddress,
} from './adminPageSessionDisplayHelpers';
import { getChainName } from './adminPageHelpers';

describe('adminPageSessionDisplayHelpers', () => {
  it('keys worker-canonical admin state by the route and canonical worker identity', () => {
    const first = buildAdminPageSessionIdentityKey({
      initialSessionId: 'session-a',
      initialRegistryChainId: 84532,
      initialSessionConfig: {
        slug: 'session-a',
        sessionId: '0xaaa',
        configRevision: 'revision-a',
        corsWorkerUrl: 'https://worker-a.example.test/',
      },
    });
    const second = buildAdminPageSessionIdentityKey({
      initialSessionId: 'session-b',
      initialRegistryChainId: 84532,
      initialSessionConfig: {
        slug: 'session-b',
        sessionId: '0xbbb',
        configRevision: 'revision-b',
        corsWorkerUrl: 'https://worker-b.example.test',
      },
    });

    expect(first).not.toBe(second);
    expect(
      buildAdminPageSessionIdentityKey({
        initialSessionId: 'session-b',
        initialRegistryChainId: 84532,
        initialSessionConfig: {
          slug: 'session-a',
          sessionId: '0xaaa',
          corsWorkerUrl: 'https://worker-a.example.test',
        },
      }),
    ).not.toBe(first);
    expect(
      buildAdminPageSessionIdentityKey({
        initialSessionId: ' SESSION-A ',
        initialRegistryChainId: '84532',
        initialSessionConfig: {
          slug: 'session-a',
          sessionId: '0xAAA',
          configRevision: 'revision-a',
          corsWorkerUrl: 'https://worker-a.example.test',
        },
      }),
    ).toBe(first);
    expect(
      buildAdminPageSessionIdentityKey({
        initialSessionId: 'session-a',
        initialRegistryChainId: 84532,
        initialSessionConfig: {
          slug: 'session-a',
          sessionId: '0xaaa',
          configRevision: 'ordinary-metadata-update',
          adminAddress: '0x0000000000000000000000000000000000000001',
          corsWorkerUrl: 'https://worker-a.example.test',
        },
      }),
    ).toBe(first);
  });

  it('builds session URLs using normalized slugs and general-session fallback', () => {
    expect(buildSessionUrl(' Edge Session ')).toBe(`${window.location.origin}/session/edgesession`);
    expect(buildSessionUrl('general')).toBe('');
    expect(buildSessionUrl('general', { allowGeneral: true })).toBe(`${window.location.origin}/session`);
    expect(buildSessionUrl(null, { allowGeneral: true })).toBe('');
  });

  it('resolves admin session display URLs by config, metadata, then selected slug', () => {
    expect(getAdminSessionDisplayUrl()).toBe('');
    expect(
      getAdminSessionDisplayUrl({
        selectedSlug: 'selected',
        selectedConfig: { slug: 'config-slug' },
        groupMetadata: { slug: 'metadata-slug' },
      }),
    ).toBe(`${window.location.origin}/session/config-slug`);
    expect(
      getAdminSessionDisplayUrl({
        selectedSlug: 'selected',
        groupMetadata: { slug: 'metadata-slug' },
      }),
    ).toBe(`${window.location.origin}/session/metadata-slug`);
  });

  it('formats short addresses consistently', () => {
    expect(shortAddress('0x1234567890abcdef')).toBe('0x1234…cdef');
    expect(shortAddress('')).toBe('');
  });

  it('formats chain and registry labels without changing same-chain or split-chain display', () => {
    const baseSepoliaName = getChainName(84532);
    const opSepoliaName = getChainName(11155420);

    expect(buildAdminChainRegistryDisplay({ chainId: 84532 })).toBe(`${baseSepoliaName} (84532)`);
    expect(buildAdminChainRegistryDisplay({ chainId: 84532, registryChainId: '84532' })).toBe(
      `${baseSepoliaName} (84532)`,
    );
    expect(buildAdminChainRegistryDisplay({ chainId: 11155420, registryChainId: 84532 })).toBe(
      `${opSepoliaName} (11155420) / ${baseSepoliaName} (84532)`,
    );
    expect(buildAdminChainRegistryDisplay()).toBe('\u2014');
  });

  it('collects encrypted metadata entries from legacy and provider locations', () => {
    expect(
      collectEncryptedEntries({
        encryptedFields: {
          prompt: 'cipher-a',
          empty: '',
        },
        sessionInfoEncrypted: 'cipher-session',
        ai: {
          providers: {
            openai: { encryptedApiKey: 'cipher-openai' },
          },
        },
        rpc: {
          providers: {
            '84532': { encryptedApiKey: 'cipher-rpc' },
          },
        },
        arweave: { encryptedJwk: 'cipher-arweave' },
        faucet: { encryptedPrivateKey: 'cipher-faucet' },
      }),
    ).toEqual({
      prompt: 'cipher-a',
      sessionInfo: 'cipher-session',
      'ai.providers.openai.apiKey': 'cipher-openai',
      'rpc.providers.84532.apiKey': 'cipher-rpc',
      'arweave.jwk': 'cipher-arweave',
      'faucet.privateKey': 'cipher-faucet',
    });
    expect(collectEncryptedEntries(null)).toEqual({});
  });

  it('builds stable encrypted entry signatures for cloned envelopes', () => {
    const first = {
      b: 'ciphertext',
      a: {
        z: ['one', { c: true, b: false }],
        y: 2,
      },
    };
    const second = {
      a: {
        y: 2,
        z: ['one', { b: false, c: true }],
      },
      b: 'ciphertext',
    };

    expect(buildAdminEncryptedEntrySignature(first)).toBe(buildAdminEncryptedEntrySignature(second));
    expect(areAdminEncryptedEntriesEquivalent(first, second)).toBe(true);
    expect(areAdminEncryptedEntriesEquivalent(first, { ...second, b: 'other' })).toBe(false);
  });
});
