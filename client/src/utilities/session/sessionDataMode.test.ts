import { resolveSessionDataMode } from './sessionDataMode';

describe('resolveSessionDataMode', () => {
  it('uses onchain mode for normal sessions', () => {
    expect(resolveSessionDataMode({
      sessionConfig: { sessionName: 'Demo' },
      telegramAuth: { loggedIn: true },
    })).toBe('onchain');
  });

  it('uses telegram mode only when a telegram-only session has auth', () => {
    expect(resolveSessionDataMode({
      sessionConfig: { telegramOnly: true },
      telegramAuth: { loggedIn: false },
    })).toBe('onchain');
    expect(resolveSessionDataMode({
      sessionConfig: { telegramOnly: true },
      telegramAuth: { loggedIn: true },
    })).toBe('telegram');
  });

  it('honors the session-meta probe when config is synthetic or missing', () => {
    expect(resolveSessionDataMode({
      probeResult: { telegramOnly: true, telegramBridgeEnabled: true },
      telegramAuth: { ok: true },
    })).toBe('telegram');
  });
});
