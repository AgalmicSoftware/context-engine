/**
 * @module aiSettings
 * @description Central AI settings resolver — merges session-level defaults with local user overrides
 *              for model selection, provider configuration, and transcription settings.
 *
 * Key exports: getEffectiveAiConfig, getEffectiveTranscriptionConfig, getSessionAiSettings, getLocalAiSettings, saveLocalAiSettings
 */
// Central AI settings resolver (session defaults + local overrides).

import { USE_ONCHAIN_SESSION_REGISTRY } from '../../variables/appConfig.js';
import store from '../../store.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { toStr } from '../shared/primitives.js';
import { sessionRegistryStore } from '../web3/sessionRegistry.js';
import { resolveSessionConfigFromSources } from '../session/canonicalSessionContext.js';
import { resolveActiveSessionSlug } from '../session/sessionNaming.js';
import { getDemoSessionConfigForDisplay } from '../session/sessionSourceResolver.js';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { createLogger } from '../logging.js';

const log = createLogger('aiSettings');


export const AI_PROVIDERS = Object.freeze({
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  OPENROUTER: 'openrouter',
  CUSTOM: 'custom',
  LOCAL: 'local',
});

export const AI_MODEL_TYPES = Object.freeze({
  FAST: 'fast',
  THINKING: 'thinking',
});

export const AI_SETTINGS_STORAGE_KEY = 'ce:aiSettings:v1';
export const AI_SETTINGS_ENVELOPE_VERSION = 1;
export const AI_SETTINGS_ENVELOPE_KIND = 'ai-settings';

export const DEFAULT_REASONING_EFFORT = 'low';

const DEFAULT_PRESET = 'gpt-5';

const DEFAULT_MODELS = Object.freeze({
  fast: 'gpt-5',
  thinking: 'gpt-5',
});
const DEFAULT_MODEL_PROVIDERS = Object.freeze({
  fast: AI_PROVIDERS.OPENAI,
  thinking: AI_PROVIDERS.OPENAI,
});

const DEFAULT_TRANSCRIPTION = Object.freeze({
  provider: AI_PROVIDERS.OPENAI,
  model: 'whisper-1',
  rpcUrl: '',
});

const DEFAULT_PROVIDER = Object.freeze({
  apiKey: '',
  encryptedApiKey: '',
});

export const AI_PRESET_CONFIGS = Object.freeze({
  'gpt-5': Object.freeze({
    provider: AI_PROVIDERS.OPENAI,
    models: Object.freeze({
      fast: 'gpt-5',
      thinking: 'gpt-5',
    }),
  }),
  'gpt-4o': Object.freeze({
    provider: AI_PROVIDERS.OPENAI,
    models: Object.freeze({
      fast: 'gpt-4o',
      thinking: 'gpt-4o',
    }),
  }),
  'claude-sonnet': Object.freeze({
    provider: AI_PROVIDERS.ANTHROPIC,
    models: Object.freeze({
      fast: 'claude-sonnet-4-6',
      thinking: 'claude-sonnet-4-6',
    }),
  }),
  'claude-opus': Object.freeze({
    provider: AI_PROVIDERS.ANTHROPIC,
    models: Object.freeze({
      fast: 'claude-opus-4-6',
      thinking: 'claude-opus-4-6',
    }),
  }),
});

const PRELOGIN_PROVIDER_PRESETS = Object.freeze({
  [AI_PROVIDERS.OPENAI]: 'gpt-5',
  [AI_PROVIDERS.ANTHROPIC]: 'claude-sonnet',
});

const DEFAULT_TASK_REASONING_EFFORT = Object.freeze({
  generate: 'low',
  rewrite: null,
  summarize: null,
  rank: null,
});

const DEFAULT_SETTINGS = Object.freeze({
  useLocal: false,
  preset: DEFAULT_PRESET,
  mode: AI_PROVIDERS.OPENAI,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
  taskReasoningEffort: DEFAULT_TASK_REASONING_EFFORT,
  models: DEFAULT_MODELS,
  modelProviders: DEFAULT_MODEL_PROVIDERS,
  transcription: DEFAULT_TRANSCRIPTION,
  providers: {
    anthropic: { ...DEFAULT_PROVIDER },
    openai: { ...DEFAULT_PROVIDER },
    openrouter: { ...DEFAULT_PROVIDER },
    custom: { ...DEFAULT_PROVIDER, rpcUrl: '', functions: '' },
  },
});

const toLower = (val) => toStr(val).trim().toLowerCase();
const normalizeReasoningEffort = (value, fallback = DEFAULT_REASONING_EFFORT) => {
  const normalized = toLower(value || fallback);
  return ['low', 'medium', 'high'].includes(normalized) ? normalized : DEFAULT_REASONING_EFFORT;
};
const normalizeOptionalReasoningEffort = (value) => {
  const normalized = toLower(value);
  return normalized ? normalizeReasoningEffort(normalized) : null;
};
export const toModelLeaf = (model) => toLower(model).split('/').pop();
export const deriveAiPreset = ({ mode, models, modelProviders } = {}) => {
  const fastModel = toModelLeaf(models?.fast || '');
  const thinkingModel = toModelLeaf(models?.thinking || '');
  const fastProvider = toLower(modelProviders?.fast || mode || '');
  const thinkingProvider = toLower(modelProviders?.thinking || mode || '');

  if (!fastModel || !thinkingModel || fastModel !== thinkingModel) return 'custom';
  if (!fastProvider || !thinkingProvider || fastProvider !== thinkingProvider) return 'custom';

  const match = Object.entries(AI_PRESET_CONFIGS).find(([, preset]) => (
    preset.provider === fastProvider &&
    toModelLeaf(preset.models.fast) === fastModel &&
    toModelLeaf(preset.models.thinking) === thinkingModel
  ));
  return match ? match[0] : 'custom';
};
const normalizeTaskReasoningEffort = (raw = {}) => {
  const obj = (raw && typeof raw === 'object') ? raw : {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(obj, key);
  return {
    generate: hasOwn('generate')
      ? normalizeOptionalReasoningEffort(obj.generate)
      : DEFAULT_TASK_REASONING_EFFORT.generate,
    rewrite: hasOwn('rewrite')
      ? normalizeOptionalReasoningEffort(obj.rewrite)
      : DEFAULT_TASK_REASONING_EFFORT.rewrite,
    summarize: hasOwn('summarize')
      ? normalizeOptionalReasoningEffort(obj.summarize)
      : DEFAULT_TASK_REASONING_EFFORT.summarize,
    rank: hasOwn('rank')
      ? normalizeOptionalReasoningEffort(obj.rank)
      : DEFAULT_TASK_REASONING_EFFORT.rank,
  };
};

const WORKER_KEY_META = Object.freeze({
  apiKey: '',
  status: 'worker',
  encryptedAvailable: false,
});
const buildSkippedKeyMeta = (providerEntry = {}) => ({
  apiKey: '',
  status: 'skipped',
  encryptedAvailable: !!(
    toStr(providerEntry.apiKey).trim() ||
    providerEntry.encryptedApiKey
  ),
});

const stripProviderKeys = (settings = {}) => {
  const providers = settings.providers && typeof settings.providers === 'object' ? settings.providers : {};
  const scrub = (entry = {}) => ({
    ...entry,
    apiKey: '',
    encryptedApiKey: '',
  });
  return {
    ...settings,
    providers: {
      anthropic: scrub(providers.anthropic || {}),
      openai: scrub(providers.openai || {}),
      openrouter: scrub(providers.openrouter || {}),
      custom: scrub(providers.custom || {}),
    },
  };
};

const getAiSettingsStorage = (storageIn) => {
  if (storageIn !== undefined) return storageIn;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch (_) {}
  return null;
};

const hasProviderPlaintextKey = (entry = {}) => !!toStr(entry?.apiKey).trim();
const hasProviderEncryptedKey = (entry = {}) => !!toStr(entry?.encryptedApiKey).trim();
// Regression guard: plaintext keys are runtime-only; persistence must stay on
// the envelope writer so normal saves cannot downgrade or leak apiKey values.
let volatileLocalAiProviderKeys = {};

const summarizeAiSettingsSecretMetadata = (settings = {}) => {
  const providers = settings?.providers && typeof settings.providers === 'object'
    ? settings.providers
    : {};
  const entries = Object.values(providers);
  return {
    encryptedAvailable: entries.some((entry) => hasProviderEncryptedKey(entry)),
    legacyPlaintextDetected: entries.some((entry) => hasProviderPlaintextKey(entry)),
  };
};

const rememberVolatilePlaintextProviderKeys = (settings = {}) => {
  const providers = settings?.providers && typeof settings.providers === 'object'
    ? settings.providers
    : {};
  volatileLocalAiProviderKeys = {
    ...volatileLocalAiProviderKeys,
    ...Object.entries(providers).reduce((acc, [provider, entry]) => {
      if (!entry || typeof entry !== 'object' || !Object.prototype.hasOwnProperty.call(entry, 'apiKey')) {
        return acc;
      }
      const apiKey = toStr(entry.apiKey).trim();
      acc[provider] = apiKey;
      return acc;
    }, {}),
  };
  Object.keys(volatileLocalAiProviderKeys).forEach((provider) => {
    if (!volatileLocalAiProviderKeys[provider]) {
      delete volatileLocalAiProviderKeys[provider];
    }
  });
};

const overlayVolatilePlaintextProviderKeys = (settings = {}) => {
  if (!Object.keys(volatileLocalAiProviderKeys).length) return settings;
  const normalized = normalizeAiSettings(settings, { includeUseLocal: true });
  return {
    ...normalized,
    providers: Object.entries(normalized.providers || {}).reduce((acc, [provider, entry]) => {
      acc[provider] = {
        ...entry,
        apiKey: volatileLocalAiProviderKeys[provider] || entry.apiKey || '',
      };
      return acc;
    }, {}),
  };
};

const stripPlaintextProviderKeys = (settings = {}) => {
  const normalized = normalizeAiSettings(settings, { includeUseLocal: true });
  const providers = normalized.providers && typeof normalized.providers === 'object'
    ? normalized.providers
    : {};
  return {
    ...normalized,
    providers: Object.entries(providers).reduce((acc, [provider, entry]) => {
      acc[provider] = {
        ...entry,
        apiKey: '',
      };
      return acc;
    }, {}),
  };
};

const normalizeProvider = (raw = {}, extras = {}) => {
  const obj = (raw && typeof raw === 'object') ? raw : {};
  return {
    ...extras,
    apiKey: toStr(obj.apiKey || obj.key || obj.token || ''),
    encryptedApiKey: toStr(obj.encryptedApiKey || obj.encryptedKey || obj.encrypted || ''),
  };
};

const normalizeModels = (raw = {}, fallbackProvider, providerOverridesRaw = {}) => {
  const obj = (raw && typeof raw === 'object') ? raw : {};
  const providerOverrides =
    (providerOverridesRaw && typeof providerOverridesRaw === 'object') ? providerOverridesRaw : {};
  const fastProviderOverride = toLower(providerOverrides.fast || providerOverrides.default || '');
  const thinkingProviderOverride = toLower(providerOverrides.thinking || providerOverrides.reasoning || '');
  const normalizeEntry = (entry, fallbackModel, providerFallback) => {
    if (entry && typeof entry === 'object') {
      return {
        model: toStr(entry.model || entry.name || entry.value || fallbackModel),
        provider: toLower(entry.provider || providerFallback || DEFAULT_MODEL_PROVIDERS.fast),
      };
    }
    return {
      model: toStr(entry || fallbackModel),
      provider: toLower(providerFallback || DEFAULT_MODEL_PROVIDERS.fast),
    };
  };
  const fastEntry = normalizeEntry(
    obj.fast || obj.default,
    DEFAULT_MODELS.fast,
    fastProviderOverride || fallbackProvider,
  );
  const thinkingEntry = normalizeEntry(
    obj.thinking || obj.reasoning,
    DEFAULT_MODELS.thinking,
    thinkingProviderOverride || fallbackProvider,
  );
  return {
    models: {
      fast: toStr(fastEntry.model || DEFAULT_MODELS.fast),
      thinking: toStr(thinkingEntry.model || DEFAULT_MODELS.thinking),
    },
    modelProviders: {
      fast: toLower(fastEntry.provider || fastProviderOverride || DEFAULT_MODEL_PROVIDERS.fast),
      thinking: toLower(thinkingEntry.provider || thinkingProviderOverride || DEFAULT_MODEL_PROVIDERS.thinking),
    },
  };
};

const normalizeTranscription = (raw = {}) => {
  const obj = (raw && typeof raw === 'object') ? raw : {};
  return {
    provider: toLower(obj.provider || DEFAULT_TRANSCRIPTION.provider) || DEFAULT_TRANSCRIPTION.provider,
    model: toStr(obj.model || DEFAULT_TRANSCRIPTION.model),
    rpcUrl: toStr(obj.rpcUrl || ''),
  };
};

const applyAiPresetConfig = (settings = {}, presetKey = '') => {
  const current = normalizeAiSettings(settings, { includeUseLocal: true });
  const nextPreset = toStr(presetKey || '').trim() || 'custom';
  if (nextPreset === 'custom') {
    return {
      ...current,
      preset: 'custom',
    };
  }

  const preset = AI_PRESET_CONFIGS[nextPreset];
  if (!preset?.provider || !preset?.models) {
    return {
      ...current,
      preset: 'custom',
    };
  }

  return {
    ...current,
    preset: nextPreset,
    mode: preset.provider,
    models: {
      ...(current.models || {}),
      ...preset.models,
    },
    modelProviders: {
      ...(current.modelProviders || {}),
      fast: preset.provider,
      thinking: preset.provider,
    },
  };
};

export const applyPreLoginAiProviderKeyChange = (settings = {}, {
  provider,
  apiKey,
} = {}) => {
  const nextProvider = toLower(provider || '');
  const current = normalizeAiSettings(settings, { includeUseLocal: true });
  const nextKey = toStr(apiKey || '');
  const nextSettings = {
    ...current,
    providers: {
      ...(current.providers || {}),
      [nextProvider]: {
        ...(current.providers?.[nextProvider] || {}),
        apiKey: nextKey,
      },
    },
  };
  const presetKey = PRELOGIN_PROVIDER_PRESETS[nextProvider];

  if (!presetKey) return nextSettings;
  if (toStr(nextKey).trim()) {
    return applyAiPresetConfig({
      ...nextSettings,
      useLocal: true,
    }, presetKey);
  }

  const activeProvider = toLower(nextSettings.mode || '');
  if (!nextSettings.useLocal || activeProvider !== nextProvider) {
    return nextSettings;
  }

  const fallbackProvider = Object.keys(PRELOGIN_PROVIDER_PRESETS).find((candidate) => (
    candidate !== nextProvider &&
    !!toStr(nextSettings.providers?.[candidate]?.apiKey).trim()
  ));
  if (fallbackProvider) {
    return applyAiPresetConfig({
      ...nextSettings,
      useLocal: true,
    }, PRELOGIN_PROVIDER_PRESETS[fallbackProvider]);
  }

  return {
    ...nextSettings,
    useLocal: false,
  };
};

export const normalizeAiSettings = (raw = {}, opts = {}) => {
  const includeUseLocal = opts.includeUseLocal !== false;
  const obj = (raw && typeof raw === 'object') ? raw : {};

  const mode = toLower(obj.mode || obj.provider || DEFAULT_SETTINGS.mode) || DEFAULT_SETTINGS.mode;
  const reasoningEffort = normalizeReasoningEffort(obj.reasoningEffort || obj.reasoning_effort);
  const modelsRaw = obj.models && typeof obj.models === 'object' ? obj.models : {};
  const modelProvidersRaw = obj.modelProviders && typeof obj.modelProviders === 'object' ? obj.modelProviders : {};
  const normalizedModels = normalizeModels(modelsRaw, mode, modelProvidersRaw);
  const transcriptionSource = modelsRaw.transcription || obj.transcription;
  const transcription = normalizeTranscription(transcriptionSource);
  const taskReasoningEffort = normalizeTaskReasoningEffort(obj.taskReasoningEffort);
  const preset = deriveAiPreset({
    mode,
    models: normalizedModels.models,
    modelProviders: normalizedModels.modelProviders,
  });

  const providersRaw = obj.providers && typeof obj.providers === 'object' ? obj.providers : {};
  const customRaw =
    providersRaw.custom ||
    obj.custom ||
    {};
  let customFunctions = '';
  if (typeof customRaw.functions === 'string') {
    customFunctions = customRaw.functions;
  } else if (customRaw.functions != null) {
    try {
      customFunctions = JSON.stringify(customRaw.functions);
    } catch {
      customFunctions = '';
    }
  }

  return {
    ...(includeUseLocal ? { useLocal: !!obj.useLocal } : {}),
    preset,
    mode,
    reasoningEffort,
    taskReasoningEffort,
    models: normalizedModels.models,
    modelProviders: normalizedModels.modelProviders,
    transcription,
    providers: {
      anthropic: normalizeProvider(providersRaw.anthropic || obj.anthropic, DEFAULT_SETTINGS.providers.anthropic),
      openai: normalizeProvider(providersRaw.openai || obj.openai, DEFAULT_SETTINGS.providers.openai),
      openrouter: normalizeProvider(providersRaw.openrouter || obj.openrouter, DEFAULT_SETTINGS.providers.openrouter),
      custom: normalizeProvider(customRaw, {
        ...DEFAULT_SETTINGS.providers.custom,
        rpcUrl: toStr(customRaw.rpcUrl || ''),
        functions: toStr(customFunctions || ''),
      }),
    },
  };
};

const buildDefaultAiSettings = (includeUseLocal = true) => (
  normalizeAiSettings(DEFAULT_SETTINGS, { includeUseLocal })
);

export const normalizeLocalAiSettingsEnvelopeRecord = (raw = null) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      status: 'missing',
      settings: null,
      metadata: {
        encryptedAvailable: false,
        legacyPlaintextDetected: false,
      },
    };
  }

  if (Number(raw.v || 0) === AI_SETTINGS_ENVELOPE_VERSION && raw.kind === AI_SETTINGS_ENVELOPE_KIND) {
    const settings = normalizeAiSettings(raw.settings || {}, { includeUseLocal: true });
    const secretMeta = summarizeAiSettingsSecretMetadata(settings);
    return {
      ok: true,
      status: 'envelope',
      settings,
      metadata: {
        encryptedAvailable: !!raw.metadata?.encryptedAvailable || secretMeta.encryptedAvailable,
        legacyPlaintextDetected: !!raw.metadata?.legacyPlaintextDetected || secretMeta.legacyPlaintextDetected,
        requiresWallet: !!raw.metadata?.requiresWallet,
      },
    };
  }

  const settings = normalizeAiSettings(raw, { includeUseLocal: true });
  return {
    ok: true,
    status: 'legacy',
    settings,
    metadata: {
      ...summarizeAiSettingsSecretMetadata(settings),
      requiresWallet: false,
    },
  };
};

export const readLocalAiSettingsEnvelope = ({ storage } = {}) => {
  const storageRef = getAiSettingsStorage(storage);
  if (!storageRef) {
    return {
      ok: false,
      status: 'missing-storage',
      settings: null,
      metadata: {
        encryptedAvailable: false,
        legacyPlaintextDetected: false,
      },
    };
  }
  try {
    const raw = JSON.parse(storageRef.getItem(AI_SETTINGS_STORAGE_KEY) || 'null');
    return normalizeLocalAiSettingsEnvelopeRecord(raw);
  } catch (error) {
    return {
      ok: false,
      status: 'parse-failed',
      settings: null,
      error: toStr(error?.message || error),
      metadata: {
        encryptedAvailable: false,
        legacyPlaintextDetected: false,
      },
    };
  }
};

export const writeLocalAiSettingsEnvelope = (nextSettings = {}, { storage } = {}) => {
  const storageRef = getAiSettingsStorage(storage);
  if (!storageRef) {
    return {
      ok: false,
      status: 'missing-storage',
      error: 'localStorage is unavailable.',
    };
  }

  const normalized = normalizeAiSettings(nextSettings, { includeUseLocal: true });
  const metadata = summarizeAiSettingsSecretMetadata(normalized);
  const envelope = {
    v: AI_SETTINGS_ENVELOPE_VERSION,
    kind: AI_SETTINGS_ENVELOPE_KIND,
    updatedAt: Date.now(),
    settings: stripPlaintextProviderKeys(normalized),
    metadata: {
      encryptedAvailable: metadata.encryptedAvailable,
      legacyPlaintextDetected: metadata.legacyPlaintextDetected,
      requiresWallet: metadata.encryptedAvailable,
    },
  };

  try {
    storageRef.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(envelope));
    return {
      ok: true,
      status: 'written',
      envelope,
    };
  } catch (error) {
    return {
      ok: false,
      status: 'write-failed',
      error: toStr(error?.message || error),
    };
  }
};

export const migrateLegacyLocalAiSettingsIfNeeded = ({ storage } = {}) => {
  const current = readLocalAiSettingsEnvelope({ storage });
  if (!current.ok || current.status !== 'legacy') return current;
  if (current.metadata?.legacyPlaintextDetected && !current.metadata?.encryptedAvailable) {
    return {
      ...current,
      status: 'skipped-plaintext-only',
      reason: 'encrypted-key-missing',
    };
  }
  return writeLocalAiSettingsEnvelope(current.settings, { storage });
};

const resolveSessionConfigEntry = (slugIn = '') => {
  const resolved = resolveSessionConfigFromSources({
    sessionSlug: slugIn,
    getRegistrySessionConfig: (slug) => sessionRegistryStore.getSessionConfig(slug),
    preferRegistry: true,
    allowDemoFallback: false,
  });
  if (resolved.sessionConfig || !defaultStrictAllowDemoFallback()) return resolved;
  const demoConfig = getDemoSessionConfigForDisplay(resolved.sessionSlug);
  return {
    ...resolved,
    sessionConfig: demoConfig,
    sessionConfigSource: demoConfig ? 'demo' : 'missing',
    warnings: resolved.warnings || [],
  };
};

// Legacy alias removed — function is now resolveSessionConfigEntry directly.

const getActiveSessionSlugFromStore = () => {
  try {
    return resolveActiveSessionSlug(store?.getState?.()?.sessionState || {});
  } catch {
    return '';
  }
};

// Legacy alias removed — function is now getActiveSessionSlugFromStore directly.

export const getSessionAiSettings = (slugIn = '') => {
  const resolved = resolveSessionConfigEntry(slugIn);
  const session = resolved.sessionConfig;
  const normalized = normalizeAiSettings(session?.ai || {}, { includeUseLocal: false });
  const sanitized = stripProviderKeys(normalized);
  return {
    ...sanitized,
    _sessionSlug: resolved.sessionSlug || session?.slug || '',
    _sessionName: session?.sessionName || '',
    _sessionConfigSource: resolved.sessionConfigSource || 'missing',
  };
};

// Legacy alias removed — function is now getSessionAiSettings directly.

export const getLocalAiSettings = () => {
  const result = readLocalAiSettingsEnvelope();
  const settings = result.ok && result.settings
    ? normalizeAiSettings(result.settings, { includeUseLocal: true })
    : buildDefaultAiSettings(true);
  return overlayVolatilePlaintextProviderKeys(settings);
};

export const saveLocalAiSettings = (nextSettings = {}) => {
  if (typeof window === 'undefined') return buildDefaultAiSettings(true);
  try {
    const current = getLocalAiSettings();
    const next = (nextSettings && typeof nextSettings === 'object') ? nextSettings : {};
    const merged = normalizeAiSettings({
      ...current,
      ...next,
      models: {
        ...(current.models || {}),
        ...(next.models || {}),
      },
      modelProviders: {
        ...(current.modelProviders || {}),
        ...(next.modelProviders || {}),
      },
      taskReasoningEffort: {
        ...(current.taskReasoningEffort || {}),
        ...(next.taskReasoningEffort || {}),
      },
      transcription: {
        ...(current.transcription || {}),
        ...(next.transcription || {}),
      },
      providers: {
        ...(current.providers || {}),
        ...(next.providers || {}),
        anthropic: {
          ...(current.providers?.anthropic || {}),
          ...(next.providers?.anthropic || {}),
        },
        openai: {
          ...(current.providers?.openai || {}),
          ...(next.providers?.openai || {}),
        },
        openrouter: {
          ...(current.providers?.openrouter || {}),
          ...(next.providers?.openrouter || {}),
        },
        custom: {
          ...(current.providers?.custom || {}),
          ...(next.providers?.custom || {}),
        },
      },
    }, { includeUseLocal: true });
    rememberVolatilePlaintextProviderKeys(next);
    const result = writeLocalAiSettingsEnvelope(merged);
    if (!result.ok) throw new Error(result.error || result.status || 'Failed to save local AI settings.');
    return overlayVolatilePlaintextProviderKeys(
      normalizeAiSettings(result.envelope?.settings || merged, { includeUseLocal: true })
    );
  } catch {
    return buildDefaultAiSettings(true);
  }
};

export const clearLocalAiSettings = () => {
  volatileLocalAiProviderKeys = {};
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(AI_SETTINGS_STORAGE_KEY); } catch (e) { log.warn('aiSettings: fallback', e); }
};

export const resolveAiSettings = ({ sessionSlug, preferLocal } = {}) => {
  const effectiveSlug =
    (typeof sessionSlug === 'string' && sessionSlug.length >= 0)
      ? sessionSlug
      : getActiveSessionSlugFromStore();
  const local = getLocalAiSettings();
  const session = getSessionAiSettings(effectiveSlug || '');
  const useLocal = (typeof preferLocal === 'boolean') ? preferLocal : !!local.useLocal;
  const settings = useLocal ? local : session;
  return {
    settings,
    source: useLocal ? 'local' : 'session',
    local,
    session,
    group: session
  };
};

const getWalletContext = (override = {}) => {
  try {
    const state = store?.getState?.();
    const profile = state?.profile || {};
    const network = profile.network || {};
    const chainId =
      override.chainId ||
      network.id ||
      network.chainId ||
      null;
    return {
      account: override.account || profile.account || '',
      providerLike: override.providerLike || profile.provider || 'wagmi',
      chainId,
    };
  } catch {
    return {
      account: override.account || '',
      providerLike: override.providerLike || 'wagmi',
      chainId: override.chainId || null,
    };
  }
};

const getLitHooks = (override = {}) => {
  if (override.lit) return override.lit;
  if (typeof window === 'undefined') return null;
  return window.__litHooks || window.litHooks || null;
};

const parseFunctionsJson = (raw) => {
  const str = toStr(raw).trim();
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const resolveApiKey = async (providerEntry = {}, context = {}, opts = {}) => {
  const includeMeta = !!opts.includeMeta;
  const apiKey = toStr(providerEntry.apiKey).trim();
  if (apiKey) {
    return includeMeta
      ? { apiKey, status: 'plain', encryptedAvailable: false }
      : apiKey;
  }

  const encrypted = providerEntry.encryptedApiKey;
  if (!encrypted) {
    return includeMeta
      ? { apiKey: '', status: 'missing', encryptedAvailable: false }
      : '';
  }

  const envelopeJson = typeof encrypted === 'string' ? encrypted : JSON.stringify(encrypted);
  if (!envelopeJson || envelopeJson === 'null') {
    return includeMeta
      ? { apiKey: '', status: 'missing', encryptedAvailable: false }
      : '';
  }

  const wallet = getWalletContext(context);
  const lit = getLitHooks(context);

  if (!wallet.account) {
    return includeMeta
      ? { apiKey: '', status: 'wallet-required', encryptedAvailable: true }
      : '';
  }
  if (!lit || typeof lit.getKey !== 'function') {
    return includeMeta
      ? { apiKey: '', status: 'lit-unavailable', encryptedAvailable: true }
      : '';
  }

  try {
    const value = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
      account: wallet.account,
      chainId: wallet.chainId,
      providerLike: wallet.providerLike,
      litOpts: lit || undefined,
    });
    const decoded = toStr(value).trim();
    return includeMeta
      ? { apiKey: decoded, status: decoded ? 'encrypted' : 'locked', encryptedAvailable: true }
      : decoded;
  } catch {
    return includeMeta
      ? { apiKey: '', status: 'locked', encryptedAvailable: true }
      : '';
  }
};

export const getEffectiveAiConfig = async ({
  sessionSlug,
  preferLocal,
  provider,
  model,
  thinking,
  context,
  resolveSecrets = true,
} = {}) => {
  const { source, settings, local, session } = resolveAiSettings({ sessionSlug, preferLocal });
  const preferLocalResolved = (typeof preferLocal === 'boolean') ? preferLocal : !!local.useLocal;
  const modelType = thinking ? AI_MODEL_TYPES.THINKING : AI_MODEL_TYPES.FAST;
  const sessionProvider =
    toLower(provider || session.modelProviders?.[modelType] || session.mode || DEFAULT_SETTINGS.mode) ||
    DEFAULT_SETTINGS.mode;
  const localProvider =
    toLower(provider || local.modelProviders?.[modelType] || local.mode || DEFAULT_SETTINGS.mode) ||
    DEFAULT_SETTINGS.mode;
  const sessionModel =
    toStr(model || session.models?.[modelType] || DEFAULT_SETTINGS.models[modelType]);
  const localModel =
    toStr(model || local.models?.[modelType] || DEFAULT_SETTINGS.models[modelType]);

  const sessionProviderEntry = session.providers?.[sessionProvider] || DEFAULT_SETTINGS.providers[sessionProvider] || {};
  const localProviderEntry = local.providers?.[localProvider] || DEFAULT_SETTINGS.providers[localProvider] || {};
  const sessionKey = { ...WORKER_KEY_META };
  const shouldResolveLocalKey = preferLocalResolved && resolveSecrets;
  const localKey = shouldResolveLocalKey
    ? await resolveApiKey(localProviderEntry, context, { includeMeta: true })
    : buildSkippedKeyMeta(localProviderEntry);
  const useLocalKey = preferLocalResolved;
  const selectedProvider = useLocalKey ? localProvider : sessionProvider;
  const providerEntry = useLocalKey ? localProviderEntry : sessionProviderEntry;
  const resolvedKey = useLocalKey ? localKey : sessionKey;
  const apiKey = resolvedKey.apiKey || '';
  const selectedModel = useLocalKey ? localModel : sessionModel;

  return {
    provider: selectedProvider,
    model: selectedModel,
    modelType,
    preset: toStr(settings?.preset || deriveAiPreset({
      mode: settings?.mode,
      models: settings?.models,
      modelProviders: settings?.modelProviders,
    }) || DEFAULT_PRESET) || DEFAULT_PRESET,
    reasoningEffort: normalizeReasoningEffort(settings?.reasoningEffort || DEFAULT_REASONING_EFFORT),
    reasoning_effort: normalizeReasoningEffort(settings?.reasoningEffort || DEFAULT_REASONING_EFFORT),
    taskReasoningEffort: normalizeTaskReasoningEffort(settings?.taskReasoningEffort),
    apiKey,
    apiKeyStatus: resolvedKey.status || 'missing',
    apiKeyEncryptedAvailable: !!resolvedKey.encryptedAvailable,
    apiKeySource: useLocalKey ? 'local' : 'session',
    sessionApiKeySource: useLocalKey ? 'local' : 'session',
    preferLocal: preferLocalResolved,
    sessionKeyStatus: sessionKey.status || 'missing',
    groupKeyStatus: sessionKey.status || 'missing',
    localKeyStatus: localKey.status || 'missing',
    providerEntry,
    source,
    local,
    session,
    group: session,
    customRpcUrl: selectedProvider === AI_PROVIDERS.CUSTOM ? toStr(providerEntry.rpcUrl || '') : '',
    customFunctions: selectedProvider === AI_PROVIDERS.CUSTOM ? toStr(providerEntry.functions || '') : '',
    customFunctionsParsed: selectedProvider === AI_PROVIDERS.CUSTOM ? parseFunctionsJson(providerEntry.functions) : null,
  };
};

export const getEffectiveTranscriptionConfig = async ({
  sessionSlug,
  preferLocal,
  provider,
  model,
  apiKey,
  rpcUrl,
  context,
} = {}) => {
  const { local, session } = resolveAiSettings({ sessionSlug, preferLocal });
  const preferLocalResolved = (typeof preferLocal === 'boolean') ? preferLocal : !!local.useLocal;
  const hasExplicitKey = !!toStr(apiKey).trim();
  const sessionTranscription = session.models?.transcription || session.transcription;
  const localTranscription = local.models?.transcription || local.transcription;
  const sessionProvider =
    toLower(provider || sessionTranscription?.provider || DEFAULT_TRANSCRIPTION.provider) ||
    DEFAULT_TRANSCRIPTION.provider;
  const localProvider =
    toLower(provider || localTranscription?.provider || DEFAULT_TRANSCRIPTION.provider) ||
    DEFAULT_TRANSCRIPTION.provider;
  const sessionModel = toStr(model || sessionTranscription?.model || DEFAULT_TRANSCRIPTION.model);
  const localModel = toStr(model || localTranscription?.model || DEFAULT_TRANSCRIPTION.model);
  const sessionProviderEntry = session.providers?.[sessionProvider] || DEFAULT_SETTINGS.providers[sessionProvider] || {};
  const localProviderEntry = local.providers?.[localProvider] || DEFAULT_SETTINGS.providers[localProvider] || {};
  const sessionKey = { ...WORKER_KEY_META };
  const localKey = preferLocalResolved
    ? await resolveApiKey(localProviderEntry, context, { includeMeta: true })
    : buildSkippedKeyMeta(localProviderEntry);
  const localRpcUrl = toStr(
    rpcUrl ||
    localTranscription?.rpcUrl ||
    localProviderEntry.rpcUrl ||
    ''
  );
  const useInlineKey = hasExplicitKey;
  const localTranscriptionHasKey = !!(toStr(apiKey).trim() || toStr(localKey.apiKey).trim());
  const shouldUseLocalSettings = preferLocalResolved && (
    localProvider === AI_PROVIDERS.LOCAL ||
    (localProvider === AI_PROVIDERS.OPENAI && localTranscriptionHasKey) ||
    (localProvider === AI_PROVIDERS.CUSTOM && !!localRpcUrl)
  );
  if (preferLocalResolved && localProvider === AI_PROVIDERS.CUSTOM && !localRpcUrl) {
    throw new Error('Custom transcription requires an RPC URL.');
  }

  // Regression guard: local text overrides are not automatically local audio
  // overrides. Anthropic/openrouter text presets should fall back to the
  // session transcription path unless a real local OpenAI/custom path exists.
  const selectedProvider = shouldUseLocalSettings ? localProvider : sessionProvider;
  const selectedModel = shouldUseLocalSettings ? localModel : sessionModel;
  const providerEntry = shouldUseLocalSettings ? localProviderEntry : sessionProviderEntry;
  const resolvedMeta = shouldUseLocalSettings ? localKey : sessionKey;
  const resolvedKey =
    selectedProvider === AI_PROVIDERS.LOCAL
      ? ''
      : (toStr(apiKey).trim() || resolvedMeta.apiKey || '');

  const finalRpcUrl =
    selectedProvider === AI_PROVIDERS.CUSTOM
      ? toStr(
        rpcUrl ||
        (shouldUseLocalSettings ? localTranscription?.rpcUrl : sessionTranscription?.rpcUrl) ||
        providerEntry.rpcUrl ||
        ''
      )
      : '';
  if (selectedProvider === AI_PROVIDERS.CUSTOM && !finalRpcUrl) {
    throw new Error('Custom transcription requires an RPC URL.');
  }

  return {
    provider: selectedProvider,
    model: selectedModel,
    apiKey: resolvedKey,
    apiKeyStatus: resolvedMeta.status || 'missing',
    apiKeyEncryptedAvailable: !!resolvedMeta.encryptedAvailable,
    apiKeySource: (shouldUseLocalSettings || useInlineKey) ? 'local' : 'session',
    sessionApiKeySource: (shouldUseLocalSettings || useInlineKey) ? 'local' : 'session',
    preferLocal: preferLocalResolved,
    sessionKeyStatus: sessionKey.status || 'missing',
    groupKeyStatus: sessionKey.status || 'missing',
    localKeyStatus: localKey.status || 'missing',
    rpcUrl: finalRpcUrl,
    source: shouldUseLocalSettings ? 'local' : 'session',
    local,
    session,
    group: session,
  };
};

export const getEffectiveSessionAiConfig = getEffectiveAiConfig;
export const getEffectiveSessionTranscriptionConfig = getEffectiveTranscriptionConfig;

export const parseCustomFunctions = parseFunctionsJson;
