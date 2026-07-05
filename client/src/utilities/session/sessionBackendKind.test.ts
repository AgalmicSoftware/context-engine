import {
  isTelegramFirstSessionConfig,
  resolveSessionBackendKind,
} from './sessionBackendKind';

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
