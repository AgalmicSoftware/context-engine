import {
  __test__resetTelegramSessionMetaCache,
  fetchTelegramSessionMeta,
  isTelegramOnlySessionConfig,
} from './telegramSessionMeta.js';

const okResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

const errorResponse = (status = 500, body: unknown = {}) => ({
  ok: false,
  status,
  json: async () => body,
});

describe('telegramSessionMeta', () => {
  beforeEach(() => {
    __test__resetTelegramSessionMetaCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('detects Telegram-only session config variants', () => {
    expect(isTelegramOnlySessionConfig({ telegramOnly: true })).toBe(true);
    expect(isTelegramOnlySessionConfig({ telegram_only: true })).toBe(true);
    expect(isTelegramOnlySessionConfig({ sessionMode: 'telegram_only' })).toBe(true);
    expect(isTelegramOnlySessionConfig({ sessionMode: ' TELEGRAM_ONLY ' })).toBe(true);
    expect(isTelegramOnlySessionConfig({ telegramMode: 'telegram_only' })).toBe(true);
    expect(isTelegramOnlySessionConfig({ telegram: { only: true } })).toBe(true);
    expect(isTelegramOnlySessionConfig({ telegram: { mode: 'telegram_only' } })).toBe(true);
    expect(isTelegramOnlySessionConfig({ telegram: { mode: 'Telegram_Only' } })).toBe(true);
    expect(isTelegramOnlySessionConfig({})).toBe(false);
    expect(isTelegramOnlySessionConfig(null)).toBe(false);
    expect(isTelegramOnlySessionConfig({ telegramOnly: false })).toBe(false);
  });

  it('builds the session-meta URL and returns successful metadata', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse({
      ok: true,
      sessionSlug: 'alpha',
      telegramOnly: true,
      telegramBridgeEnabled: true,
    }));

    await expect(fetchTelegramSessionMeta({
      sessionSlug: 'alpha',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    })).resolves.toEqual({
      telegramOnly: true,
      telegramBridgeEnabled: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toEqual(
      expect.stringMatching(
        /^https:\/\/bridge\.example\/telegram\/agent\/api\/session-meta\?sessionSlug=alpha/
      )
    );
  });

  it('returns null for missing inputs and failed responses', async () => {
    const fetchImpl = jest.fn();

    await expect(fetchTelegramSessionMeta({
      sessionSlug: '',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    })).resolves.toBeNull();
    await expect(fetchTelegramSessionMeta({
      sessionSlug: 'alpha',
      agentBridgeUrl: '',
      fetchImpl,
    })).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();

    fetchImpl.mockResolvedValueOnce(errorResponse(503));
    await expect(fetchTelegramSessionMeta({
      sessionSlug: 'alpha',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    })).resolves.toBeNull();

    fetchImpl.mockResolvedValueOnce(okResponse({ ok: false }));
    await expect(fetchTelegramSessionMeta({
      sessionSlug: 'beta',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    })).resolves.toBeNull();

    fetchImpl.mockRejectedValueOnce(new Error('network down'));
    await expect(fetchTelegramSessionMeta({
      sessionSlug: 'gamma',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    })).resolves.toBeNull();
  });

  it('caches sequential successful calls for the same bridge and slug', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse({
      ok: true,
      telegramOnly: true,
      telegramBridgeEnabled: false,
    }));
    const args = {
      sessionSlug: 'alpha',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    };

    await expect(fetchTelegramSessionMeta(args)).resolves.toEqual({
      telegramOnly: true,
      telegramBridgeEnabled: false,
    });
    await expect(fetchTelegramSessionMeta(args)).resolves.toEqual({
      telegramOnly: true,
      telegramBridgeEnabled: false,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent successful calls for the same bridge and slug', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse({
      ok: true,
      telegramOnly: true,
      telegramBridgeEnabled: true,
    }));
    const args = {
      sessionSlug: 'alpha',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    };

    await expect(Promise.all([
      fetchTelegramSessionMeta(args),
      fetchTelegramSessionMeta(args),
    ])).resolves.toEqual([
      { telegramOnly: true, telegramBridgeEnabled: true },
      { telegramOnly: true, telegramBridgeEnabled: true },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not cache failed calls', async () => {
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(okResponse({
        ok: true,
        telegramOnly: true,
        telegramBridgeEnabled: true,
      }));
    const args = {
      sessionSlug: 'alpha',
      agentBridgeUrl: 'https://bridge.example',
      fetchImpl,
    };

    await expect(fetchTelegramSessionMeta(args)).resolves.toBeNull();
    await expect(fetchTelegramSessionMeta(args)).resolves.toEqual({
      telegramOnly: true,
      telegramBridgeEnabled: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
