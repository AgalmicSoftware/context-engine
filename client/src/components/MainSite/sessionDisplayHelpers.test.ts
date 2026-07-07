import {
  getSessionHeaderForGroup,
  getSessionInfoForGroup,
  getSessionNameForGroup,
  hasEncryptedSessionField,
} from './sessionDisplayHelpers.js';

const normalizeSessionSlug = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const createTextOpts = (overrides: Record<string, unknown> = {}, demoConfig: unknown = null) => ({
  overrides,
  normalizeSessionSlug,
  getDemoSessionConfigBySlug: jest.fn(() => demoConfig),
  hasEncryptedSessionField,
});

const createHeaderOpts = (overrides: Record<string, unknown> = {}, demoConfig: unknown = null) => ({
  overrides,
  normalizeSessionSlug,
  getDemoSessionConfigBySlug: jest.fn(() => demoConfig),
  normalizeArweaveUrl: jest.fn((value: string) => `normalized:${String(value || '').trim()}`),
});

describe('sessionDisplayHelpers', () => {
  describe('hasEncryptedSessionField', () => {
    it('returns true for encryptedFields.sessionName', () => {
      expect(
        hasEncryptedSessionField(
          {
            encryptedFields: { sessionName: true },
          },
          'sessionName',
        ),
      ).toBe(true);
    });

    it('returns true for legacy sessionNameEncrypted', () => {
      expect(
        hasEncryptedSessionField(
          {
            sessionNameEncrypted: true,
          },
          'sessionName',
        ),
      ).toBe(true);
    });

    it('returns false for unknown fields', () => {
      expect(
        hasEncryptedSessionField(
          {
            encryptedFields: { unknown: true },
          },
          'unknown',
        ),
      ).toBe(false);
    });
  });

  describe('getSessionInfoForGroup', () => {
    it('returns an override when present for the normalized slug', () => {
      const opts = createTextOpts(
        { alpha: 'Override info' },
        {
          sessionInfo: 'Demo info',
        },
      );

      expect(getSessionInfoForGroup({ slug: ' Alpha ', sessionInfo: 'Config info' }, '', opts)).toBe('Override info');
    });

    it('returns Encrypted when session info is encrypted and not overridden', () => {
      const opts = createTextOpts();

      expect(
        getSessionInfoForGroup(
          {
            slug: 'alpha',
            sessionInfo: 'Config info',
            encryptedFields: { sessionInfo: true },
          },
          '',
          opts,
        ),
      ).toBe('Encrypted');
    });

    it('cascades through config fields', () => {
      const opts = createTextOpts();

      expect(getSessionInfoForGroup({ sessionInfo: 'Session info field' }, 'alpha', opts)).toBe('Session info field');
      expect(getSessionInfoForGroup({ info: 'Info field' }, 'alpha', opts)).toBe('Info field');
      expect(getSessionInfoForGroup({ description: 'Description field' }, 'alpha', opts)).toBe('Description field');
    });

    it('falls back to demo session fields', () => {
      const opts = createTextOpts(
        {},
        {
          description: 'Demo description',
        },
      );

      expect(getSessionInfoForGroup({}, 'alpha', opts)).toBe('Demo description');
      expect(opts.getDemoSessionConfigBySlug).toHaveBeenCalledWith('alpha', {
        allowDemoFallback: true,
      });
    });

    it('does not mask missing registry metadata with demo fallback fields', () => {
      const opts = createTextOpts(
        {},
        {
          description: 'Demo description',
        },
      );

      expect(
        getSessionInfoForGroup(
          {
            slug: 'alpha',
            __registry: { sessionIdHex: '0xabc' },
          },
          'alpha',
          opts,
        ),
      ).toBe('');
      expect(opts.getDemoSessionConfigBySlug).not.toHaveBeenCalled();
    });
  });

  describe('getSessionNameForGroup', () => {
    it('returns an override when present for the normalized slug', () => {
      const opts = createTextOpts(
        { alpha: 'Override name' },
        {
          sessionName: 'Demo name',
        },
      );

      expect(getSessionNameForGroup({ slug: ' Alpha ', sessionName: 'Config name' }, '', opts)).toBe('Override name');
    });

    it('returns Encrypted when session name is encrypted and not overridden', () => {
      const opts = createTextOpts();

      expect(
        getSessionNameForGroup(
          {
            slug: 'alpha',
            sessionName: 'Config name',
            encryptedSessionName: true,
          },
          '',
          opts,
        ),
      ).toBe('Encrypted');
    });

    it('cascades through config fields', () => {
      const opts = createTextOpts();

      expect(getSessionNameForGroup({ sessionName: 'Session name field' }, 'alpha', opts)).toBe('Session name field');
      expect(getSessionNameForGroup({ name: 'Name field' }, 'alpha', opts)).toBe('Name field');
      expect(getSessionNameForGroup({ title: 'Title field' }, 'alpha', opts)).toBe('Title field');
    });

    it('falls back to demo session fields', () => {
      const opts = createTextOpts(
        {},
        {
          title: 'Demo title',
        },
      );

      expect(getSessionNameForGroup({}, 'alpha', opts)).toBe('Demo title');
      expect(opts.getDemoSessionConfigBySlug).toHaveBeenCalledWith('alpha', {
        allowDemoFallback: true,
      });
    });

    it('does not mask missing registry title metadata with demo fallback fields', () => {
      const opts = createTextOpts(
        {},
        {
          title: 'Demo title',
        },
      );

      expect(
        getSessionNameForGroup(
          {
            slug: 'alpha',
            __registry: { metadataURI: 'ar://metadata' },
          },
          'alpha',
          opts,
        ),
      ).toBe('');
      expect(opts.getDemoSessionConfigBySlug).not.toHaveBeenCalled();
    });
  });

  describe('getSessionHeaderForGroup', () => {
    it('returns a normalized arweave URL from an override', () => {
      const opts = createHeaderOpts({ alpha: ' ar://override-header ' });

      expect(getSessionHeaderForGroup({ slug: 'Alpha' }, '', opts)).toBe('normalized:ar://override-header');
      expect(opts.normalizeArweaveUrl).toHaveBeenCalledWith(' ar://override-header ', {
        contextLabel: 'session_header_image',
      });
    });

    it('cascades through config fields', () => {
      const opts = createHeaderOpts();

      expect(
        getSessionHeaderForGroup(
          {
            sessionHeaderImg: 'ar://session-header-img',
          },
          'alpha',
          opts,
        ),
      ).toBe('normalized:ar://session-header-img');
      expect(getSessionHeaderForGroup({ headerImage: 'ar://header-image' }, 'alpha', opts)).toBe(
        'normalized:ar://header-image',
      );
      expect(getSessionHeaderForGroup({ header: 'ar://header' }, 'alpha', opts)).toBe('normalized:ar://header');
    });

    it('uses a normalized demo fallback', () => {
      const opts = createHeaderOpts(
        {},
        {
          sessionHeader: ' ar://demo-header ',
        },
      );

      expect(getSessionHeaderForGroup({}, 'alpha', opts)).toBe('normalized:ar://demo-header');
      expect(opts.getDemoSessionConfigBySlug).toHaveBeenCalledWith('alpha', {
        allowDemoFallback: true,
      });
      expect(opts.normalizeArweaveUrl).toHaveBeenLastCalledWith(' ar://demo-header ', {
        contextLabel: 'session_header_image',
      });
    });

    it('does not mask missing registry header metadata with a demo fallback image', () => {
      const opts = createHeaderOpts(
        {},
        {
          sessionHeader: ' ar://demo-header ',
        },
      );

      expect(
        getSessionHeaderForGroup(
          {
            slug: 'alpha',
            sessionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          },
          'alpha',
          opts,
        ),
      ).toBe('normalized:');
      expect(opts.getDemoSessionConfigBySlug).not.toHaveBeenCalled();
    });
  });
});
