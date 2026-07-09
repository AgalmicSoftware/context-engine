import {
  buildCanDecryptContext,
  evaluateCanDecryptPreCheck,
  resolveCanDecryptGateAccess,
} from './surveyToolCanDecryptController';
import type { CanDecryptContextInputs, CanDecryptSnapshot, CheckAccessFn } from './surveyToolCanDecryptController';

const makeInputs = (overrides: Partial<CanDecryptContextInputs> = {}): CanDecryptContextInputs => ({
  getEffectiveDraftSlug: () => 'test-slug',
  resolveEffectiveSlugFromProps: () => 'fallback-slug',
  resolveEffectiveResponseGateConfig: jest.fn().mockReturnValue({ networkChainId: 84532 }),
  getResponseGatePolicy: jest.fn().mockReturnValue({
    recipients: ['0xabc'],
    primaryResource: 'questionResponses',
  }),
  account: '0x1234567890abcdef',
  loginComplete: true,
  singleQuestionMode: false,
  isStandalone: false,
  sbtCacheRevision: 1,
  ...overrides,
});

const makeSnapshot = (overrides: Partial<CanDecryptSnapshot> = {}): CanDecryptSnapshot => ({
  loggedIn: true,
  account: '0x1234',
  recipients: ['0xabc'],
  resourceKeysToCheck: ['questionResponses', 'default'],
  key: 'key',
  signature: 'sig',
  ...overrides,
});

describe('surveyToolCanDecryptController', () => {
  describe('buildCanDecryptContext', () => {
    it('derives slug from getEffectiveDraftSlug when it is non-empty', () => {
      const resolveEffectiveSlugFromProps = jest.fn(() => 'fallback-slug');
      const inputs = makeInputs({ resolveEffectiveSlugFromProps });

      const result = buildCanDecryptContext(inputs);

      expect(result.slug).toBe('test-slug');
      expect(resolveEffectiveSlugFromProps).not.toHaveBeenCalled();
    });

    it('falls back to resolveEffectiveSlugFromProps when draft slug is empty', () => {
      const resolveEffectiveSlugFromProps = jest.fn(() => 'fallback-slug');
      const inputs = makeInputs({
        getEffectiveDraftSlug: () => '',
        resolveEffectiveSlugFromProps,
      });

      const result = buildCanDecryptContext(inputs);

      expect(result.slug).toBe('fallback-slug');
      expect(resolveEffectiveSlugFromProps).toHaveBeenCalledTimes(1);
    });

    it('calls resolveEffectiveResponseGateConfig with the derived slug', () => {
      const resolveEffectiveResponseGateConfig = jest.fn().mockReturnValue({ networkChainId: 84532 });
      const inputs = makeInputs({
        getEffectiveDraftSlug: () => '',
        resolveEffectiveSlugFromProps: () => 'derived-slug',
        resolveEffectiveResponseGateConfig,
      });

      buildCanDecryptContext(inputs);

      expect(resolveEffectiveResponseGateConfig).toHaveBeenCalledWith('derived-slug');
    });

    it('calls getResponseGatePolicy and passes the policy through to the snapshot', () => {
      const policy = {
        recipients: ['0xabc', '0xdef'],
        primaryResource: 'surveyResponses',
      };
      const getResponseGatePolicy = jest.fn().mockReturnValue(policy);
      const inputs = makeInputs({ getResponseGatePolicy });

      const result = buildCanDecryptContext(inputs);

      expect(getResponseGatePolicy).toHaveBeenCalledTimes(1);
      expect(result.policy).toBe(policy);
      expect(result.snapshot.recipients).toEqual(policy.recipients);
      expect(result.snapshot.resourceKeysToCheck).toEqual(['surveyResponses', 'default']);
    });

    it('returns slug, cfg, policy, and snapshot with the expected structure', () => {
      const cfg = { networkChainId: 84532 };
      const policy = {
        recipients: ['0xabc'],
        primaryResource: 'questionResponses',
      };
      const inputs = makeInputs({
        resolveEffectiveResponseGateConfig: jest.fn().mockReturnValue(cfg),
        getResponseGatePolicy: jest.fn().mockReturnValue(policy),
      });

      expect(buildCanDecryptContext(inputs)).toEqual({
        slug: 'test-slug',
        cfg,
        policy,
        snapshot: {
          loggedIn: true,
          account: '0x1234567890abcdef',
          recipients: ['0xabc'],
          resourceKeysToCheck: ['questionResponses', 'default'],
          key: '0x1234567890abcdef|test-slug|questionResponses,default|1|||1',
          signature: '0x1234567890abcdef|test-slug|questionResponses,default|1|||1',
        },
      });
    });
  });

  describe('evaluateCanDecryptPreCheck', () => {
    it('returns earlyExit true with needs-wallet when logged out', () => {
      expect(evaluateCanDecryptPreCheck(makeSnapshot({ loggedIn: false }))).toEqual({
        earlyExit: true,
        status: 'needs-wallet',
      });
    });

    it('returns earlyExit true with no-gate when recipients are empty and wallet is ready', () => {
      expect(evaluateCanDecryptPreCheck(makeSnapshot({ recipients: [] }))).toEqual({
        earlyExit: true,
        status: 'no-gate',
      });
    });

    it('returns earlyExit false when logged in and recipients are present', () => {
      expect(evaluateCanDecryptPreCheck(makeSnapshot())).toEqual({ earlyExit: false });
    });
  });

  describe('resolveCanDecryptGateAccess', () => {
    it('calls checkAccess for each resource key in order', async () => {
      const checkAccess: CheckAccessFn = jest
        .fn()
        .mockResolvedValueOnce({ status: 'denied' })
        .mockResolvedValueOnce({ status: 'granted' });

      await resolveCanDecryptGateAccess(
        {
          cfg: { networkChainId: 84532 },
          slug: 'session-slug',
          account: '0x1234',
          resourceKeysToCheck: ['questionResponses', 'default'],
        },
        checkAccess,
      );

      expect(checkAccess).toHaveBeenCalledTimes(2);
      expect(checkAccess).toHaveBeenNthCalledWith(1, {
        sessionConfig: { networkChainId: 84532 },
        sessionSlug: 'session-slug',
        account: '0x1234',
        resourceKey: 'questionResponses',
      });
      expect(checkAccess).toHaveBeenNthCalledWith(2, {
        sessionConfig: { networkChainId: 84532 },
        sessionSlug: 'session-slug',
        account: '0x1234',
        resourceKey: 'default',
      });
    });

    it('returns granted when any checked resource is granted, including after an earlier denial', async () => {
      const checkAccess: CheckAccessFn = jest
        .fn()
        .mockResolvedValueOnce({ status: 'denied' })
        .mockResolvedValueOnce({ status: 'granted' });

      await expect(
        resolveCanDecryptGateAccess(
          {
            cfg: {},
            slug: 'slug',
            account: '0x1234',
            resourceKeysToCheck: ['questionResponses', 'default'],
          },
          checkAccess,
        ),
      ).resolves.toEqual({
        canDecrypt: true,
        status: 'granted',
      });
    });

    it('returns denied when all checked resources are denied', async () => {
      const checkAccess: CheckAccessFn = jest
        .fn()
        .mockResolvedValueOnce({ status: 'denied' })
        .mockResolvedValueOnce({ status: 'denied' });

      await expect(
        resolveCanDecryptGateAccess(
          {
            cfg: {},
            slug: 'slug',
            account: '0x1234',
            resourceKeysToCheck: ['questionResponses', 'default'],
          },
          checkAccess,
        ),
      ).resolves.toEqual({
        canDecrypt: false,
        status: 'denied',
      });
    });

    it.each(['unknown', 'error'])(
      'returns unknown when a checked resource resolves to %s and none are granted',
      async (status) => {
        const checkAccess: CheckAccessFn = jest
          .fn()
          .mockResolvedValueOnce({ status: 'denied' })
          .mockResolvedValueOnce({ status });

        await expect(
          resolveCanDecryptGateAccess(
            {
              cfg: {},
              slug: 'slug',
              account: '0x1234',
              resourceKeysToCheck: ['questionResponses', 'default'],
            },
            checkAccess,
          ),
        ).resolves.toEqual({
          canDecrypt: false,
          status: 'unknown',
        });
      },
    );

    it('handles a single-resource check correctly', async () => {
      const checkAccess: CheckAccessFn = jest.fn().mockResolvedValue({ status: 'granted' });

      await expect(
        resolveCanDecryptGateAccess(
          {
            cfg: {},
            slug: 'slug',
            account: '0x1234',
            resourceKeysToCheck: ['questionResponses'],
          },
          checkAccess,
        ),
      ).resolves.toEqual({
        canDecrypt: true,
        status: 'granted',
      });

      expect(checkAccess).toHaveBeenCalledTimes(1);
      expect(checkAccess).toHaveBeenCalledWith({
        sessionConfig: {},
        sessionSlug: 'slug',
        account: '0x1234',
        resourceKey: 'questionResponses',
      });
    });
  });
});
