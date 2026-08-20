import {
  getSessionWizardFieldLabel,
  getSessionWizardFieldTooltip,
  getSessionWizardOrderedDraftEntries,
  shouldHideSessionWizardField,
  splitSessionWizardDraftEntries,
} from './sessionWizardFieldDescriptors';
import type { SessionWizardModeFieldPolicy } from './sessionWizardModeFieldPolicy';

const pureWorkerPolicy: SessionWizardModeFieldPolicy = {
  showBlockLimits: false,
  showFaucet: false,
  showSessionEndsAt: true,
  showWorkerGroupDefaults: true,
  showSbtDefaults: false,
  showAgentSessionWrapped: false,
  visibleContractKeys: [],
};

describe('sessionWizardFieldDescriptors', () => {
  it('orders draft entries with canonical top-level keys first and omits worker-only fields', () => {
    const orderedEntries = getSessionWizardOrderedDraftEntries({
      defaultTags: 'governance,ai',
      embeddedDeployHelperEnabled: true,
      extraField: 'custom',
      sessionInfo: 'Details',
      appearance: { colorSchemeId: 'ocean' },
      slug: 'demo-session',
    });

    expect(orderedEntries.map(([key]) => key)).toEqual([
      'slug',
      'sessionInfo',
      'appearance',
      'defaultTags',
      'extraField',
    ]);
  });

  it('omits the legacy storage editor when the integrated session profile is present', () => {
    const orderedEntries = getSessionWizardOrderedDraftEntries({
      sessionModeProfile: { storage: { backend: 'cloudflare' } },
      storageProfile: { provider: 'cloudflare' },
    });

    expect(orderedEntries.map(([key]) => key)).toEqual(['sessionModeProfile']);
  });

  it('splits primary and more-options entries by mode', () => {
    const { primaryEntries, moreOptionsEntries } = splitSessionWizardDraftEntries(
      [
        ['sessionName', 'Demo'],
        ['appearance', { colorSchemeId: 'amber' }],
        ['groupCreationPolicy', 'participants'],
        ['sessionEndsAt', '2099-01-01T00:00:00.000Z'],
        ['blockLimits', { start: 1, end: 2 }],
        ['defaultTags', 'ai'],
      ],
      true,
    );

    expect(primaryEntries.map(([key]) => key)).toEqual(['sessionName']);
    expect(moreOptionsEntries.map(([key]) => key)).toEqual([
      'groupCreationPolicy',
      'sessionEndsAt',
      'blockLimits',
      'defaultTags',
      'appearance',
    ]);
  });

  it('resolves labels and tooltips from field descriptors', () => {
    expect(getSessionWizardFieldLabel('sessionName', 'sessionName')).toBe('Session Name');
    expect(getSessionWizardFieldLabel('appearance', 'appearance')).toBe('Session colors');
    expect(getSessionWizardFieldLabel('groupCreationPolicy', 'groupCreationPolicy')).toBe('Who can create groups?');
    expect(getSessionWizardFieldTooltip(['sessionEndsAt'], '')).toContain('participant writes stop');
  });

  it('applies shared field visibility rules', () => {
    expect(
      shouldHideSessionWizardField({
        key: 'slug',
        path: [],
        currentPath: ['slug'],
        wizardMode: 'normal',
      }),
    ).toBe(true);

    expect(
      shouldHideSessionWizardField({
        key: 'apiKey',
        path: ['ai', 'providers', 'openai'],
        currentPath: ['ai', 'providers', 'openai', 'apiKey'],
        wizardMode: 'advanced',
      }),
    ).toBe(true);

    expect(
      shouldHideSessionWizardField({
        key: 'chainId',
        path: ['contracts', 'surveys'],
        currentPath: ['contracts', 'surveys', 'chainId'],
        wizardMode: 'advanced',
      }),
    ).toBe(true);

    expect(
      shouldHideSessionWizardField({
        key: 'sessionName',
        path: [],
        currentPath: ['sessionName'],
        wizardMode: 'advanced',
      }),
    ).toBe(false);
  });

  it('keeps capability-hidden fields hidden even when guided controls force rendering', () => {
    for (const key of ['contracts', 'blockLimits', 'faucet', 'defaultSbtTags', 'agentSessionWrapped']) {
      expect(
        shouldHideSessionWizardField({
          forceShow: true,
          key,
          path: [],
          currentPath: [key],
          wizardMode: 'normal',
          modeFieldPolicy: pureWorkerPolicy,
        }),
      ).toBe(true);
    }
    expect(
      shouldHideSessionWizardField({
        forceShow: true,
        key: 'sessionEndsAt',
        path: [],
        currentPath: ['sessionEndsAt'],
        wizardMode: 'normal',
        modeFieldPolicy: pureWorkerPolicy,
      }),
    ).toBe(false);
    expect(
      shouldHideSessionWizardField({
        forceShow: true,
        key: 'corsWorkerUrl',
        path: [],
        currentPath: ['corsWorkerUrl'],
        wizardMode: 'normal',
        modeFieldPolicy: pureWorkerPolicy,
      }),
    ).toBe(false);

    for (const [key, path] of [
      ['privateKey', ['faucet']],
      ['encryptedPrivateKey', ['faucet']],
    ] as const) {
      expect(
        shouldHideSessionWizardField({
          forceShow: true,
          key,
          path: [...path],
          currentPath: [...path, key],
          wizardMode: 'advanced',
        }),
      ).toBe(true);
    }
  });

  it('removes incompatible entries from ordered Cloudflare fields', () => {
    const ordered = getSessionWizardOrderedDraftEntries(
      {
        contracts: {},
        blockLimits: {},
        faucet: {},
        sessionEndsAt: '',
        defaultGroupTags: 'facilitators',
        defaultSbtTags: 'token-holders',
      },
      pureWorkerPolicy,
    );

    expect(ordered.map(([key]) => key)).toEqual(['sessionEndsAt', 'defaultGroupTags']);
  });
});
