import {
  buildTxExplorerUrl,
  countSessionsForChain,
  getChainName,
  getErrorMessage,
  normalizeAiProvider,
  normalizeSlug,
  normalizeWorkerUrl,
  parseChainIdInput,
  resolveAdminAiTestModel,
  resolveAdminCapabilities,
} from './adminPageHelpers';
import { inferAiProviderFromModel } from '../../../../shared/aiModelFamily.mjs';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';

describe('adminPageHelpers', () => {
  it('normalizes errors, slugs, providers, and worker URLs', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage({ message: '   ' }, 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
    expect(normalizeSlug(' general ')).toBe('');
    expect(normalizeSlug(' Edge Session ')).toBe('edgesession');
    expect(normalizeWorkerUrl('https://worker.example.test///')).toBe('https://worker.example.test');
    expect(normalizeWorkerUrl('https://worker.example.test/admin/secret-presence')).toBe('https://worker.example.test');
    expect(normalizeAiProvider('Anthropic')).toBe('anthropic');
    expect(normalizeAiProvider('unknown', 'custom')).toBe('custom');
    expect(inferAiProviderFromModel('claude-3-7-sonnet')).toBe('anthropic');
    expect(inferAiProviderFromModel('gpt-4o-mini')).toBe('openai');
    expect(inferAiProviderFromModel('openai/gpt-4o-mini')).toBe('openrouter');
  });

  it('pings the session’s everyday model, or names none so the Worker picks', () => {
    expect(resolveAdminAiTestModel({ models: { fast: { provider: 'anthropic', model: 'claude-opus-5-5' } } })).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-5-5',
    });
    expect(resolveAdminAiTestModel({ models: { fast: { provider: 'anthropic' } } })).toEqual({
      provider: 'anthropic',
      model: '',
    });
    expect(resolveAdminAiTestModel({ models: { fast: { provider: 'anthropic', model: 'gpt-5' } } }).model).toBe('');
    expect(
      resolveAdminAiTestModel({ mode: 'anthropic', providers: { anthropic: { model: 'claude-haiku-5-5' } } }),
    ).toEqual({ provider: 'anthropic', model: 'claude-haiku-5-5' });
    expect(resolveAdminAiTestModel({ model: 'claude-fable-5-1' })).toEqual({
      provider: 'anthropic',
      model: 'claude-fable-5-1',
    });
    expect(resolveAdminAiTestModel({ provider: 'openrouter' })).toEqual({ provider: 'openrouter', model: '' });
    expect(resolveAdminAiTestModel(null)).toEqual({ provider: 'openai', model: '' });
  });

  it('counts sessions for registry chains and builds explorer links', () => {
    const entries = [
      ['alpha', { __registry: { chainId: 84532 } }],
      ['beta', { __registry: { registryChainId: 11155420 } }],
      ['legacy', {}],
    ];

    expect(countSessionsForChain(entries)).toBe(3);
    expect(countSessionsForChain(entries, 84532)).toBe(1);
    expect(countSessionsForChain(entries, 11155420)).toBe(1);
    expect(countSessionsForChain('bad', 84532)).toBe(0);
    expect(getChainName(84532)).not.toBe('');
    expect(buildTxExplorerUrl('0xabc', 84532)).toMatch(/\/tx\/0xabc$/);
    expect(buildTxExplorerUrl('', 84532)).toBe('');
    expect(buildTxExplorerUrl('0xabc', 0)).toBe('');
  });

  it('parses chain ids from plain and labelled inputs', () => {
    expect(parseChainIdInput('OP Sepolia (11155420)')).toBe(11155420);
    expect(parseChainIdInput(84532)).toBe(84532);
    expect(parseChainIdInput('')).toBe(0);
    expect(parseChainIdInput(null)).toBe(0);
  });

  it('keeps Worker authority projection-bound and does not infer registry authority from stale fields', () => {
    const sessionConfig = {
      adminAddress: '0x00000000000000000000000000000000000000aa',
      __registry: {
        registryChainId: 84532,
        adminAddress: '0x00000000000000000000000000000000000000bb',
      },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };

    expect(resolveAdminCapabilities({ account: sessionConfig.adminAddress, sessionConfig })).toMatchObject({
      isWorkerCanonicalSession: true,
      hasRegistryEntry: false,
      canAdminWorker: true,
      canAdminRegistry: false,
    });
    expect(resolveAdminCapabilities({ account: sessionConfig.__registry.adminAddress, sessionConfig })).toMatchObject({
      canAdminWorker: false,
      canAdminRegistry: false,
    });
  });

  it('preserves registry administration for a valid registry-canonical profile', () => {
    const adminAddress = '0x00000000000000000000000000000000000000bb';
    const sessionConfig = {
      __registry: {
        registryChainId: 84532,
        adminAddress,
      },
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
    };

    expect(resolveAdminCapabilities({ account: adminAddress, sessionConfig })).toMatchObject({
      hasRegistryEntry: true,
      canAdminWorker: true,
      canAdminRegistry: true,
    });
  });

  it('fails closed when raw Worker fields are paired with an invalid profile', () => {
    const adminAddress = '0x00000000000000000000000000000000000000aa';
    expect(
      resolveAdminCapabilities({
        account: adminAddress,
        sessionConfig: {
          adminAddress,
          sessionModeProfile: {
            profileVersion: 999,
            authority: { mode: 'worker_canonical' },
          },
        },
      }),
    ).toMatchObject({
      isWorkerCanonicalSession: false,
      canAdminWorker: false,
      canAdminRegistry: false,
    });
  });
});
