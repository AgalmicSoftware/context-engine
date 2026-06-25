import { resolveSessionDataMode } from './sessionDataMode';

describe('resolveSessionDataMode', () => {
  it('uses onchain mode for normal sessions', () => {
    expect(resolveSessionDataMode({
      sessionConfig: { sessionName: 'Demo' },
      telegramAuth: { loggedIn: true },
    })).toBe('onchain');
  });

  it('uses telegram mode for telegram-only sessions before auth is ready', () => {
    expect(resolveSessionDataMode({
      sessionConfig: { telegramOnly: true },
      telegramAuth: { loggedIn: false },
    })).toBe('telegram');
    expect(resolveSessionDataMode({
      sessionConfig: { telegramOnly: true },
      telegramAuth: { loggedIn: true },
    })).toBe('telegram');
  });

  it('honors the session-meta probe when config is synthetic or missing', () => {
    expect(resolveSessionDataMode({
      probeResult: { telegramOnly: true, telegramBridgeEnabled: true },
      telegramAuth: { ok: false },
    })).toBe('telegram');
  });
});
