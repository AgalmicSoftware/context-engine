import {
  AI_SETTINGS_ENVELOPE_KIND,
  AI_SETTINGS_STORAGE_KEY,
  applyPreLoginAiProviderKeyChange,
  clearLocalAiSettings,
  getEffectiveAiConfig,
  getEffectiveTranscriptionConfig,
  getLocalAiSettings,
  migrateLegacyLocalAiSettingsIfNeeded,
  readLocalAiSettingsEnvelope,
  saveLocalAiSettings,
  writeLocalAiSettingsEnvelope,
} from './aiSettings.js';
import { cryptoUtils } from '../crypto/cryptography.js';

const TEST_CONTEXT = {
  account: '0x0000000000000000000000000000000000000001',
  chainId: 84532,
  providerLike: 'wagmi',
  lit: {
    getKey: jest.fn(async () => new Uint8Array(32)),
  },
};

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

describe('aiSettings secret resolution', () => {
  beforeEach(() => {
    localStorage.clear();
    clearLocalAiSettings();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    clearLocalAiSettings();
    jest.restoreAllMocks();
  });

  const seedSessionAiSettings = (ai = {}) => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
            ai,
          },
        },
      }),
    );
  };

  const seedEncryptedLocalOpenAiSettings = ({ useLocal = true } = {}) => {
    saveLocalAiSettings({
      useLocal,
      mode: 'openai',
      models: {
        fast: 'gpt-4.1-mini',
      },
      modelProviders: {
        fast: 'openai',
      },
      providers: {
        openai: {
          encryptedApiKey: '{"v":1,"ciphertext":"stub"}',
        },
      },
    });
  };

  it('defaults reasoning effort to low for fresh local settings', () => {
    expect(getLocalAiSettings().reasoningEffort).toBe('low');
  });

  it('keeps plaintext provider API keys volatile while saving an envelope record', () => {
    const saved = saveLocalAiSettings({
      useLocal: true,
      providers: {
        anthropic: {
          apiKey: 'sk-ant-test',
          encryptedApiKey: '{"v":1,"ciphertext":"enc"}',
        },
      },
    });

    const settings = getLocalAiSettings();
    const storedRaw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    const stored = JSON.parse(storedRaw);
    const persisted = readLocalAiSettingsEnvelope();

    expect(saved.providers.anthropic.apiKey).toBe('sk-ant-test');
    expect(settings.providers.anthropic.apiKey).toBe('sk-ant-test');
    expect(settings.providers.anthropic.encryptedApiKey).toBe('{"v":1,"ciphertext":"enc"}');
    expect(storedRaw).not.toContain('sk-ant-test');
    expect(stored.kind).toBe(AI_SETTINGS_ENVELOPE_KIND);
    expect(stored.settings.providers.anthropic.apiKey).toBe('');
    expect(stored.settings.providers.anthropic.encryptedApiKey).toBe('{"v":1,"ciphertext":"enc"}');
    expect(persisted.settings.providers.anthropic.apiKey).toBe('');
  });

  it('does not downgrade an existing local AI envelope during normal saves', () => {
    writeLocalAiSettingsEnvelope({
      useLocal: true,
      providers: {
        openai: {
          encryptedApiKey: '{"v":1,"ciphertext":"enc-open"}',
        },
      },
    });

    const saved = saveLocalAiSettings({
      useLocal: false,
      reasoningEffort: 'high',
    });
    const stored = JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY));

    expect(saved.useLocal).toBe(false);
    expect(saved.reasoningEffort).toBe('high');
    expect(stored.kind).toBe(AI_SETTINGS_ENVELOPE_KIND);
    expect(stored.settings.useLocal).toBe(false);
    expect(stored.settings.reasoningEffort).toBe('high');
    expect(stored.settings.providers.openai.encryptedApiKey).toBe('{"v":1,"ciphertext":"enc-open"}');
  });

  it('reads legacy local AI settings through the envelope adapter with plaintext metadata', () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        useLocal: true,
        providers: {
          openai: {
            apiKey: 'sk-open-test',
            encryptedApiKey: '{"v":1,"ciphertext":"enc"}',
          },
        },
      }),
    );

    const result = readLocalAiSettingsEnvelope();

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'legacy',
        settings: expect.objectContaining({
          useLocal: true,
          providers: expect.objectContaining({
            openai: expect.objectContaining({
              apiKey: 'sk-open-test',
            }),
          }),
        }),
        metadata: expect.objectContaining({
          encryptedAvailable: true,
          legacyPlaintextDetected: true,
        }),
      }),
    );
  });

  it('writes envelope records without plaintext provider apiKey fields', () => {
    const result = writeLocalAiSettingsEnvelope({
      useLocal: true,
      providers: {
        openai: {
          apiKey: 'sk-open-test',
          encryptedApiKey: '{"v":1,"ciphertext":"enc"}',
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'written',
        envelope: expect.objectContaining({
          v: 1,
          kind: AI_SETTINGS_ENVELOPE_KIND,
        }),
      }),
    );
    const storedRaw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    expect(storedRaw).not.toContain('sk-open-test');
    const stored = JSON.parse(storedRaw);
    expect(stored.settings.providers.openai.apiKey).toBe('');
    expect(stored.settings.providers.openai.encryptedApiKey).toBe('{"v":1,"ciphertext":"enc"}');
    expect(stored.metadata).toEqual(
      expect.objectContaining({
        encryptedAvailable: true,
        legacyPlaintextDetected: true,
        requiresWallet: true,
      }),
    );
    expect(getLocalAiSettings().providers.openai.apiKey).toBe('');
  });

  it('migrates legacy local AI settings to an envelope when encrypted keys are available', () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        useLocal: true,
        providers: {
          anthropic: {
            apiKey: 'sk-ant-test',
            encryptedApiKey: '{"v":1,"ciphertext":"enc"}',
          },
        },
      }),
    );

    const result = migrateLegacyLocalAiSettingsIfNeeded();
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'written',
      }),
    );

    const stored = JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY));
    expect(stored.kind).toBe(AI_SETTINGS_ENVELOPE_KIND);
    expect(JSON.stringify(stored)).not.toContain('sk-ant-test');
    expect(stored.metadata.legacyPlaintextDetected).toBe(true);
    expect(stored.settings.providers.anthropic.encryptedApiKey).toBe('{"v":1,"ciphertext":"enc"}');
  });

  it('does not migrate plaintext-only legacy local AI settings without an encrypted replacement', () => {
    const legacySettings = {
      useLocal: true,
      providers: {
        anthropic: {
          apiKey: 'sk-ant-test',
        },
      },
    };
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(legacySettings));

    const result = migrateLegacyLocalAiSettingsIfNeeded();

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'skipped-plaintext-only',
        reason: 'encrypted-key-missing',
        metadata: expect.objectContaining({
          legacyPlaintextDetected: true,
          encryptedAvailable: false,
        }),
      }),
    );
    expect(JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY))).toEqual(legacySettings);
  });

  it('preserves top-level modelProviders overrides through local settings normalization', () => {
    saveLocalAiSettings({
      useLocal: true,
      mode: 'openai',
      models: {
        fast: 'claude-sonnet-4-6',
        thinking: 'gpt-4o',
      },
      modelProviders: {
        fast: 'anthropic',
        thinking: 'openrouter',
      },
    });

    const settings = getLocalAiSettings();

    expect(settings.modelProviders.fast).toBe('anthropic');
    expect(settings.modelProviders.thinking).toBe('openrouter');
  });

  it('activates the local OpenAI GPT-5 preset after a pre-login OpenAI key edit', async () => {
    saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(getLocalAiSettings(), {
        provider: 'openai',
        apiKey: 'sk-open-test',
      }),
    );

    const cfg = await getEffectiveAiConfig({
      preferLocal: true,
      context: TEST_CONTEXT,
    });

    expect(getLocalAiSettings()).toEqual(
      expect.objectContaining({
        useLocal: true,
        preset: 'gpt-5',
        mode: 'openai',
        providers: expect.objectContaining({
          openai: expect.objectContaining({
            apiKey: 'sk-open-test',
          }),
        }),
      }),
    );
    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe('gpt-5');
    expect(cfg.apiKey).toBe('sk-open-test');
    expect(cfg.apiKeySource).toBe('local');
  });

  it('activates the local Claude Sonnet preset after a pre-login Anthropic key edit', async () => {
    saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(getLocalAiSettings(), {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      }),
    );

    const cfg = await getEffectiveAiConfig({
      preferLocal: true,
      context: TEST_CONTEXT,
    });

    expect(getLocalAiSettings()).toEqual(
      expect.objectContaining({
        useLocal: true,
        preset: 'claude-sonnet',
        mode: 'anthropic',
        providers: expect.objectContaining({
          anthropic: expect.objectContaining({
            apiKey: 'sk-ant-test',
          }),
        }),
      }),
    );
    expect(cfg.provider).toBe('anthropic');
    expect(cfg.model).toBe('claude-sonnet-4-6');
    expect(cfg.apiKey).toBe('sk-ant-test');
    expect(cfg.apiKeySource).toBe('local');
  });

  it('skips local key decryption when resolveSecrets is false', async () => {
    seedEncryptedLocalOpenAiSettings();
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('local-secret');

    const cfg = await getEffectiveAiConfig({
      preferLocal: true,
      context: TEST_CONTEXT,
      resolveSecrets: false,
    });

    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe('gpt-4.1-mini');
    expect(cfg.apiKey).toBe('');
    expect(cfg.apiKeyStatus).toBe('skipped');
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it('does not decrypt local AI keys when local overrides are disabled', async () => {
    seedEncryptedLocalOpenAiSettings({ useLocal: false });
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('local-secret');

    const cfg = await getEffectiveAiConfig({
      preferLocal: false,
      context: TEST_CONTEXT,
    });

    expect(cfg.apiKey).toBe('');
    expect(cfg.apiKeySource).toBe('session');
    expect(cfg.localKeyStatus).toBe('skipped');
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it('does not decrypt local transcription keys when local overrides are disabled', async () => {
    seedEncryptedLocalOpenAiSettings({ useLocal: false });
    const decryptSpy = jest.spyOn(cryptoUtils, 'decryptEnvelopeValue').mockResolvedValue('local-secret');

    const cfg = await getEffectiveTranscriptionConfig({
      preferLocal: false,
      context: TEST_CONTEXT,
    });

    expect(cfg.apiKey).toBe('');
    expect(cfg.apiKeySource).toBe('session');
    expect(cfg.localKeyStatus).toBe('skipped');
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it('keeps the session transcription provider when only an explicit apiKey is supplied', async () => {
    saveLocalAiSettings({
      useLocal: false,
      transcription: {
        provider: 'custom',
        model: 'custom-whisper',
        rpcUrl: 'https://custom-transcribe.example/v1/audio/transcriptions',
      },
      providers: {
        custom: {
          rpcUrl: 'https://custom-transcribe.example/v1/audio/transcriptions',
        },
      },
    });

    const cfg = await getEffectiveTranscriptionConfig({
      preferLocal: false,
      apiKey: 'sk-inline',
      context: TEST_CONTEXT,
    });

    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe('whisper-1');
    expect(cfg.apiKey).toBe('sk-inline');
    expect(cfg.rpcUrl).toBe('');
  });

  it('does not treat an Anthropic-only local text override as local transcription', async () => {
    saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(getLocalAiSettings(), {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      }),
    );

    const cfg = await getEffectiveTranscriptionConfig({
      sessionSlug: '',
      preferLocal: true,
      context: TEST_CONTEXT,
    });

    expect(cfg.provider).toBe('openai');
    expect(cfg.model).toBe('whisper-1');
    expect(cfg.apiKey).toBe('');
    expect(cfg.apiKeySource).toBe('session');
    expect(cfg.source).toBe('session');
  });

  it('falls back to the session transcription config when the local override is text-only', async () => {
    seedSessionAiSettings({
      models: {
        transcription: {
          provider: 'custom',
          model: 'session-whisper',
          rpcUrl: 'https://session-transcribe.example/v1/audio/transcriptions',
        },
      },
      transcription: {
        provider: 'custom',
        model: 'session-whisper',
        rpcUrl: 'https://session-transcribe.example/v1/audio/transcriptions',
      },
      providers: {
        custom: {
          rpcUrl: 'https://session-transcribe.example/v1/audio/transcriptions',
        },
      },
    });
    saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(getLocalAiSettings(), {
        provider: 'anthropic',
        apiKey: 'sk-ant-test',
      }),
    );

    const cfg = await getEffectiveTranscriptionConfig({
      sessionSlug: '',
      preferLocal: true,
      context: TEST_CONTEXT,
    });

    expect(cfg.provider).toBe('custom');
    expect(cfg.model).toBe('session-whisper');
    expect(cfg.rpcUrl).toBe('https://session-transcribe.example/v1/audio/transcriptions');
    expect(cfg.apiKeySource).toBe('session');
    expect(cfg.source).toBe('session');
  });

  it('disables local override when the active pre-login provider key is cleared and no fallback key remains', async () => {
    saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(getLocalAiSettings(), {
        provider: 'openai',
        apiKey: 'sk-open-test',
      }),
    );
    saveLocalAiSettings(
      applyPreLoginAiProviderKeyChange(getLocalAiSettings(), {
        provider: 'openai',
        apiKey: '',
      }),
    );

    const localSettings = getLocalAiSettings();
    const cfg = await getEffectiveAiConfig({
      preferLocal: localSettings.useLocal,
      context: TEST_CONTEXT,
    });

    expect(localSettings.useLocal).toBe(false);
    expect(localSettings.providers.openai.apiKey).toBe('');
    expect(cfg.apiKeySource).toBe('session');
    expect(cfg.provider).toBe('openai');
  });

  it('fails fast when custom transcription is selected without an rpcUrl', async () => {
    saveLocalAiSettings({
      useLocal: true,
      transcription: {
        provider: 'custom',
        model: 'custom-whisper',
        rpcUrl: '',
      },
    });

    await expect(
      getEffectiveTranscriptionConfig({
        preferLocal: true,
        context: TEST_CONTEXT,
      }),
    ).rejects.toThrow('Custom transcription requires an RPC URL.');
  });
});
