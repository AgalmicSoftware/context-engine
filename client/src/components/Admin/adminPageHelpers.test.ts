import {
  buildTxExplorerUrl,
  countSessionsForChain,
  getChainName,
  getErrorMessage,
  inferAiProviderFromModel,
  normalizeAiProvider,
  normalizeSlug,
  normalizeWorkerUrl,
  resolveAdminCapabilities,
} from './adminPageHelpers';
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

  it('keeps worker and registry admin capabilities independent', () => {
    const sessionConfig = {
      adminAddress: '0x00000000000000000000000000000000000000aa',
      __registry: {
        registryChainId: 84532,
        adminAddress: '0x00000000000000000000000000000000000000bb',
      },
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };

    expect(resolveAdminCapabilities({ account: sessionConfig.adminAddress, sessionConfig })).toMatchObject({
      isWorkerCanonicalSession: true,
      hasRegistryEntry: true,
      canAdminWorker: true,
      canAdminRegistry: false,
    });
    expect(resolveAdminCapabilities({ account: sessionConfig.__registry.adminAddress, sessionConfig })).toMatchObject({
      canAdminWorker: false,
      canAdminRegistry: true,
    });
  });
});
