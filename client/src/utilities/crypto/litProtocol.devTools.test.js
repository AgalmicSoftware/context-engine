import { attachLitDevTools } from './litProtocol.js';

describe('attachLitDevTools', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete window.__litTools;
  });

  it('never publishes window.__litTools in production builds', () => {
    process.env.NODE_ENV = 'production';

    expect(attachLitDevTools({ account: '0x00000000000000000000000000000000000000aa' })).toBeNull();
    expect(window.__litTools).toBeUndefined();
  });

  it('publishes the debugging helpers in development builds', () => {
    process.env.NODE_ENV = 'development';

    const tools = attachLitDevTools({ account: '0x00000000000000000000000000000000000000aa' });

    expect(window.__litTools).toBe(tools);
    expect(Object.keys(tools).sort()).toEqual(['decryptEnvelope', 'encryptForSbt']);
  });
});
