import {
  isTelegramFirstSessionConfig,
  resolveSessionBackendKind,
} from './sessionBackendKind';
import {
  SESSION_MODE_PRESET_IDS,
  cloneSessionModePreset,
} from './sessionModeProfile';

describe('sessionBackendKind', () => {
  it.each([
    [{ telegramOnly: true }],
    [{ telegram_only: true }],
    [{ sessionMode: 'telegram_only' }],
    [{ telegramMode: 'telegram_only' }],
    [{ telegram: { only: true } }],
    [{ telegram: { mode: 'telegram_only' } }],
  ])('detects legacy telegram-first config variant %#', (metadata) => {
    expect(isTelegramFirstSessionConfig(metadata)).toBe(true);
    expect(resolveSessionBackendKind({ sessionConfig: metadata })).toBe('telegram');
  });

  it('prefers sessionModeProfile for new Telegram-capable worker sessions', () => {
    const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    profile.surfaces.telegram = true;
    expect(isTelegramFirstSessionConfig({ sessionModeProfile: profile })).toBe(true);
    expect(resolveSessionBackendKind({ sessionConfig: { sessionModeProfile: profile } })).toBe('telegram');
  });

  it('uses session-meta probe results when config is not locally available', () => {
    expect(resolveSessionBackendKind({
      sessionConfig: {},
      probeResult: { ok: true, telegramOnly: true, telegramBridgeEnabled: true },
    })).toBe('telegram');
  });

  it('defaults ordinary sessions to onchain', () => {
    expect(isTelegramFirstSessionConfig({ sessionMode: 'standard' })).toBe(false);
    expect(resolveSessionBackendKind({ sessionConfig: { sessionMode: 'standard' } })).toBe('onchain');
  });
});
