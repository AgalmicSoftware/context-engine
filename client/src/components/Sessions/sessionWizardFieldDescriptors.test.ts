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
  visibleContractKeys: [],
};

describe('sessionWizardFieldDescriptors', () => {
  it('orders draft entries with canonical top-level keys first and omits worker-only fields', () => {
    const orderedEntries = getSessionWizardOrderedDraftEntries({
      defaultTags: 'governance,ai',
      embeddedDeployHelperEnabled: true,
      extraField: 'custom',
      sessionInfo: 'Details',
      slug: 'demo-session',
    });

    expect(orderedEntries.map(([key]) => key)).toEqual(['slug', 'sessionInfo', 'defaultTags', 'extraField']);
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
        ['blockLimits', { start: 1, end: 2 }],
        ['defaultTags', 'ai'],
      ],
      true,
    );

    expect(primaryEntries.map(([key]) => key)).toEqual(['sessionName']);
    expect(moreOptionsEntries.map(([key]) => key)).toEqual(['sessionEndsAt', 'blockLimits', 'defaultTags']);
  });

  it('resolves labels and tooltips from field descriptors', () => {
    expect(getSessionWizardFieldLabel('sessionName', 'sessionName')).toBe('Session Name');
    expect(getSessionWizardFieldTooltip(['faucet', 'privateKey'], '')).toContain('Lock to store as Lit-encrypted.');
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
});
