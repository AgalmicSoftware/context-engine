import { __test__contractScriptsSessionNameFields } from './chainGateway.js';

describe('contractScripts session name normalization', () => {
  const { normalizeSessionNameFields } = __test__contractScriptsSessionNameFields;

  it('keeps a provided sessionName without writing groupName', () => {
    const payload = { sessionName: 'Edge Session' };

    normalizeSessionNameFields(payload);

    expect(payload).toEqual({
      sessionName: 'Edge Session',
    });
    expect(payload).not.toHaveProperty('groupName');
  });

  it('keeps a provided sessionName even when legacy groupName is present', () => {
    const payload = { sessionName: 'Edge Session', groupName: 'legacy-value' };

    normalizeSessionNameFields(payload, '', {});

    expect(payload.sessionName).toBe('Edge Session');
  });

  it('does not promote legacy groupName into sessionName without a fallback', () => {
    const payload = { groupName: 'Legacy Session' };

    normalizeSessionNameFields(payload, '', {});

    expect(payload.sessionName).toBe('');
  });

  it('uses the fallback sessionName without writing groupName', () => {
    const payload = {};

    normalizeSessionNameFields(payload, 'Fallback Session', {});

    expect(payload).toEqual({
      sessionName: 'Fallback Session',
    });
    expect(payload).not.toHaveProperty('groupName');
  });

  it('injects canonical sessionSlug when provided by upload context', () => {
    const payload = { sessionName: 'Demo Session' };

    normalizeSessionNameFields(payload, '', { sessionSlug: ' Demo-Session_2 ' });

    expect(payload).toEqual({
      sessionName: 'Demo Session',
      sessionSlug: 'Demo-Session_2',
    });
    expect(payload).not.toHaveProperty('groupName');
  });
});
