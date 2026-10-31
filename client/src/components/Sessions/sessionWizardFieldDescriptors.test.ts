import {
  getSessionWizardFieldLabel,
  getSessionWizardFieldTooltip,
  shouldHideSessionWizardField,
} from './sessionWizardFieldDescriptors';
import type { SessionWizardModeFieldPolicy } from './sessionWizardModeFieldPolicy';
import { buildSessionWizardDefaultTemplate } from './sessionWizardDraftState';

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
  it('resolves labels and tooltips from field descriptors', () => {
    expect(getSessionWizardFieldLabel('sessionName', 'sessionName')).toBe('Session Name');
    expect(getSessionWizardFieldLabel('appearance', 'appearance')).toBe('Session colors');
    expect(getSessionWizardFieldLabel('groupCreationPolicy', 'groupCreationPolicy')).toBe('Who can create groups?');
    expect(getSessionWizardFieldLabel('interviewMode.realtimeModel', 'realtimeModel')).toBe('Interview voice model');
    expect(getSessionWizardFieldLabel('interviewMode', 'interviewMode')).toBe('Interview settings');
    expect(getSessionWizardFieldTooltip(['interviewMode'], '')).toContain('suggested question drafts');
    expect(getSessionWizardFieldTooltip(['interviewMode', 'realtimeModel'], '')).toContain('gpt-live-1');
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

    expect(
      shouldHideSessionWizardField({
        key: 'provider',
        path: ['interviewMode'],
        currentPath: ['interviewMode', 'provider'],
        wizardMode: 'normal',
      }),
    ).toBe(true);
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

  it('gives every visible default draft field a readable label instead of its key', () => {
    const everyOptionPolicy: SessionWizardModeFieldPolicy = {
      ...pureWorkerPolicy,
      showBlockLimits: true,
      showFaucet: true,
      showSbtDefaults: true,
      showAgentSessionWrapped: true,
    };
    const rawLabels = Object.keys(buildSessionWizardDefaultTemplate())
      .filter(
        (key) => !shouldHideSessionWizardField({ key, wizardMode: 'advanced', modeFieldPolicy: everyOptionPolicy }),
      )
      .filter((key) => getSessionWizardFieldLabel(key, key) === key);

    expect(rawLabels).toEqual([]);
  });
});
