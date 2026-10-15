import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../session/sessionModeProfile';
import {
  getSessionAiSettings,
  getEffectiveAiConfig,
  getEffectiveTranscriptionConfig,
  saveLocalAiSettings,
} from './aiSettings.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

describe('aiSettings session resolution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolves canonical general alias as missing when no registry data exists in on-chain mode', () => {
    const resolved = getSessionAiSettings(' GeNeRal!!! ');

    expect(resolved._sessionSlug).toBe('');
    expect(resolved._sessionConfigSource).toBe('missing');
  });

  it('uses canonical general aliases with registry data for the default session', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
          },
        },
      }),
    );

    const resolved = getSessionAiSettings(' GeNeRal!!! ');

    expect(resolved._sessionSlug).toBe('');
    expect(resolved._sessionName).toBe('Registry General');
    expect(resolved._sessionConfigSource).toBe('registry');
  });

  it('prefers registry cache for explicit non-general session slugs', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          rxc: {
            slug: 'rxc',
            sessionName: 'Registry RXC',
            ai: {
              mode: 'anthropic',
              models: {
                fast: 'claude-sonnet-4-6',
              },
              modelProviders: {
                fast: 'anthropic',
              },
            },
          },
        },
      }),
    );

    const resolved = getSessionAiSettings('rxc');

    expect(resolved._sessionSlug).toBe('rxc');
    expect(resolved._sessionName).toBe('Registry RXC');
    expect(resolved._sessionConfigSource).toBe('registry');
    expect(resolved.mode).toBe('anthropic');
    expect(resolved.models.fast).toBe('claude-sonnet-4-6');
    expect(resolved.modelProviders.fast).toBe('anthropic');
  });

  it('does not inherit the general session identity for unknown non-general slugs', () => {
    const resolved = getSessionAiSettings('missing-session-slug');

    expect(resolved._sessionSlug).toBe('missing-session-slug');
    expect(resolved._sessionName).toBe('');
    expect(resolved._sessionConfigSource).toBe('missing');
  });
});

const workerConfig = {
  slug: 'worker-session',
  sessionName: 'Synthetic Worker session',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
  ai: {
    models: {
      fast: { provider: 'openai', model: 'worker-fast-model' },
      thinking: { provider: 'openai', model: 'worker-thinking-model' },
      transcription: { provider: 'openai', model: 'worker-transcription-model' },
    },
  },
};

it('keeps the selected Worker model defaults for text and transcription while leaving keys on the Worker', async () => {
  const options = { sessionSlug: 'worker-session', sessionConfig: workerConfig, preferLocal: false };
  expect(getSessionAiSettings('worker-session', workerConfig)._sessionConfigSource).toBe('worker');
  expect(await getEffectiveAiConfig(options)).toMatchObject({
    provider: 'openai',
    model: 'worker-fast-model',
    apiKey: '',
  });
  expect(await getEffectiveAiConfig({ ...options, thinking: true })).toMatchObject({ model: 'worker-thinking-model' });
  expect(await getEffectiveTranscriptionConfig(options)).toMatchObject({
    model: 'worker-transcription-model',
    apiKey: '',
  });
  expect(getSessionAiSettings('another-session', workerConfig)._sessionName).not.toBe('Synthetic Worker session');
});

it('preserves explicit local AI overrides when a Worker config is supplied', async () => {
  localStorage.clear();
  try {
    saveLocalAiSettings({ useLocal: true, mode: 'openai', models: { fast: 'local-fast-model' } });
    expect(
      await getEffectiveAiConfig({ sessionSlug: 'worker-session', sessionConfig: workerConfig, resolveSecrets: false }),
    ).toMatchObject({ model: 'local-fast-model' });
  } finally {
    localStorage.clear();
  }
});
