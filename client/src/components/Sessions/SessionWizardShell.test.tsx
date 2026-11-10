import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { listSessionModeConflicts, type SessionSetupConflict } from '../../utilities/session/sessionModeRuleMessages';
import { RULE_FIXTURES } from '../../utilities/session/sessionModeRuleFixtures.testUtils';
import SessionWizardShell, { type SessionWizardShellProps } from './SessionWizardShell';

jest.mock('./SessionWizardSponsoredStatus', () => (props: any) => (
  <div data-testid="shell-sponsored-status" data-tone={props.status?.tone || ''}>
    <span>{props.status?.message || ''}</span>
    <button type="button" onClick={props.onRetry}>
      retry sponsored bundle
    </button>
  </div>
));

jest.mock('./EncryptionPanel', () => (props: any) => (
  <section data-testid="shell-encryption">
    <button type="button" onClick={() => props.launchCreateSbtModal({ targetType: 'gate', gateId: 'gate-1' })}>
      create sbt
    </button>
  </section>
));

jest.mock('./WorkerPanel', () => (props: any) => (
  <section
    data-testid="shell-worker"
    data-worker-url={props.displayedWorkerUrl || ''}
    data-native-template-setup={props.nativeTemplateSetupIdentity || ''}
  >
    <button type="button" onClick={() => props.onNativeTemplateSetupGenerated?.('generated-identity')}>
      generate template setup
    </button>
  </section>
));

jest.mock('./SessionWizardModals', () => (props: any) => (
  <div data-testid="shell-modals" data-session-slug={props.createSbtModalSessionSlug || ''}>
    <button type="button" onClick={props.closeCreateSbtModal}>
      close create sbt
    </button>
    <button type="button" onClick={props.closeContractViewerModal}>
      close contract
    </button>
  </div>
));

const SECTION_KEYS = ['basics', 'context', 'questions', 'participation', 'results', 'access', 'hosting', 'ai'];

const isAfter = (earlier: HTMLElement, later: HTMLElement) =>
  !!(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);

const baseProps = (overrides: Partial<SessionWizardShellProps> = {}): SessionWizardShellProps => ({
  draft: {
    sessionName: 'Demo session',
    sessionHeader: 'https://example.test/header.png',
    sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    defaultSbtTags: 'group, event',
  },
  updateDraftValue: jest.fn(),
  editProfile: jest.fn(),
  conflicts: [],
  registryChainId: null,
  onRegistryChainIdChange: jest.fn(),
  isWorkerCanonical: true,
  renderField: jest.fn((key: string) => <div data-testid={`shell-field-${key}`} />),
  slugPreview: <p data-testid="shell-slug-preview">demo-session</p>,
  encryptionPanelProps: {
    launchCreateSbtModal: jest.fn(),
  } as unknown as SessionWizardShellProps['encryptionPanelProps'],
  sbtFieldKeys: ['defaultSbtTags'],
  hostingQuick: <div data-testid="shell-hosting-quick">Cloudflare token</div>,
  hostingStatus: 'Worker deploys on Create',
  workerPanelProps: {
    displayedWorkerUrl: 'https://worker.example.test',
    nativeTemplateSetupIdentity: 'demo-session\n0xabc',
    onNativeTemplateSetupGenerated: jest.fn(),
  } as unknown as SessionWizardShellProps['workerPanelProps'],
  aiKeys: <div data-testid="shell-ai-keys">OpenAI key</div>,
  sponsoredStatusProps: {
    onRetry: jest.fn(),
    status: { message: 'Sponsored bundle loaded.', retryable: true, tone: 'success' },
  },
  createPanelProps: {
    missing: [],
    conflicts: [],
    stage: 'idle',
    busy: false,
    completed: false,
    onCreate: jest.fn(),
    onCancel: jest.fn(),
  },
  modalsProps: {
    createSbtModalSessionSlug: 'demo-session',
    closeCreateSbtModal: jest.fn(),
    closeContractViewerModal: jest.fn(),
  } as unknown as SessionWizardShellProps['modalsProps'],
  ...overrides,
});

describe('SessionWizardShell', () => {
  it('renders the sections in order with Basics open and the rest behind More', () => {
    render(<SessionWizardShell {...baseProps()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'New session' })).toBeInTheDocument();
    const ordered = [
      screen.getByTestId('shell-sponsored-status'),
      ...SECTION_KEYS.map((key) => screen.getByTestId(`ce-setup-section-${key}`)),
      screen.getByTestId('ce-setup-create'),
      screen.getByTestId('shell-modals'),
    ];
    ordered.slice(1).forEach((node, index) => {
      expect(isAfter(ordered[index], node)).toBe(true);
    });

    expect(screen.queryByTestId('ce-setup-more-basics')).not.toBeInTheDocument();
    SECTION_KEYS.slice(1).forEach((key) => {
      expect(screen.getByTestId(`ce-setup-more-${key}`)).toHaveAttribute('aria-expanded', 'false');
    });
    // Closed sections keep their quick inputs and summaries, not their bodies.
    expect(screen.getByTestId('ce-setup-section-hosting')).toContainElement(screen.getByTestId('shell-hosting-quick'));
    expect(screen.getByTestId('ce-setup-section-ai')).toContainElement(screen.getByTestId('shell-ai-keys'));
    expect(screen.getByTestId('ce-setup-summary-hosting')).toHaveTextContent('Worker deploys on Create');
    expect(screen.queryByTestId('shell-encryption')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shell-worker')).not.toBeInTheDocument();
  });

  it('gives every element a unique id and every label a field, with all sections open', () => {
    render(<SessionWizardShell {...baseProps()} />);
    SECTION_KEYS.slice(1).forEach((key) => fireEvent.click(screen.getByTestId(`ce-setup-more-${key}`)));

    const ids = Array.from(document.querySelectorAll('[id]'), (element) => element.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    const unlabelled = Array.from(document.querySelectorAll('label[for]'))
      .map((label) => label.getAttribute('for') || '')
      .filter((id) => !document.getElementById(id)?.matches('input, select, textarea, button'));
    expect(unlabelled).toEqual([]);
  });

  it('places the recovery key dialog, template actions and template notice around the page header', () => {
    render(
      <SessionWizardShell
        {...baseProps({
          recoveryKeyDialog: <div data-testid="shell-recovery-key" />,
          templateActions: <button type="button">Export</button>,
          templateNotice: <p data-testid="shell-template-notice">This draft came from a link.</p>,
        })}
      />,
    );

    const heading = screen.getByRole('heading', { level: 1, name: 'New session' });
    const header = heading.parentElement as HTMLElement;
    expect(isAfter(screen.getByTestId('shell-recovery-key'), heading)).toBe(true);
    expect(header).toContainElement(screen.getByRole('button', { name: 'Export' }));
    expect(isAfter(header, screen.getByTestId('shell-template-notice'))).toBe(true);
    expect(isAfter(screen.getByTestId('shell-template-notice'), screen.getByTestId('shell-sponsored-status'))).toBe(
      true,
    );
  });

  it('wires Basics to the draft, the header image field and the link preview', () => {
    const props = baseProps();
    render(<SessionWizardShell {...props} />);

    const basics = screen.getByTestId('ce-setup-section-basics');
    const nameInput = within(basics).getByTestId(E2E_TESTIDS.WIZARD_SESSION_NAME);
    expect(nameInput).toHaveValue('Demo session');
    fireEvent.change(nameInput, { target: { value: 'Renamed session' } });
    fireEvent.change(within(basics).getByTestId(E2E_TESTIDS.WIZARD_SESSION_INFO), {
      target: { value: 'What this session is for.' },
    });
    const colors = within(basics).getByTestId(E2E_TESTIDS.WIZARD_SESSION_COLOR_SCHEME) as HTMLSelectElement;
    const otherScheme = Array.from(colors.options).find((option) => option.value !== colors.value)?.value;
    expect(otherScheme).toBeTruthy();
    fireEvent.change(colors, { target: { value: otherScheme } });

    expect(props.updateDraftValue).toHaveBeenCalledWith(['sessionName'], 'Renamed session');
    expect(props.updateDraftValue).toHaveBeenCalledWith(['sessionInfo'], 'What this session is for.');
    expect(props.updateDraftValue).toHaveBeenCalledWith(['appearance'], { colorSchemeId: otherScheme });
    expect(props.renderField).toHaveBeenCalledWith('sessionHeader', 'https://example.test/header.png', []);
    expect(basics).toContainElement(screen.getByTestId('shell-field-sessionHeader'));
    expect(basics).toContainElement(screen.getByTestId('shell-slug-preview'));
  });

  it('embeds the gates panel and SBT defaults under Access and the Worker panel under Hosting', () => {
    const props = baseProps();
    render(<SessionWizardShell {...props} />);

    fireEvent.click(screen.getByTestId('ce-setup-more-access'));
    expect(screen.getByTestId('ce-setup-more-access')).toHaveAttribute('aria-expanded', 'true');
    const access = screen.getByTestId('ce-setup-section-access');
    const gates = within(access).getByTestId('shell-encryption');
    const sbtTags = within(access).getByTestId('shell-field-defaultSbtTags');
    expect(isAfter(gates, sbtTags)).toBe(true);
    expect(props.renderField).toHaveBeenCalledWith('defaultSbtTags', 'group, event', []);

    fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
    const worker = within(screen.getByTestId('ce-setup-section-hosting')).getByTestId('shell-worker');
    expect(worker).toBeInTheDocument();
    expect(worker).toHaveAttribute('data-worker-url', 'https://worker.example.test');

    fireEvent.click(screen.getByTestId('ce-setup-more-access'));
    expect(screen.getByTestId('ce-setup-more-access')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('shell-encryption')).not.toBeInTheDocument();
    expect(screen.getByTestId('shell-worker')).toBeInTheDocument();
  });

  it('passes the template setup marker and its setter to the Worker panel', () => {
    const props = baseProps();
    render(<SessionWizardShell {...props} />);

    fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
    expect(screen.getByTestId('shell-worker')).toHaveAttribute('data-native-template-setup', 'demo-session\n0xabc');
    fireEvent.click(screen.getByText('generate template setup'));
    expect(props.workerPanelProps.onNativeTemplateSetupGenerated).toHaveBeenCalledWith('generated-identity');
  });

  it('opens a section with a rule conflict by itself and keeps Create blocked', () => {
    const conflict: SessionSetupConflict = {
      code: 'worker_authority_requires_cloudflare',
      path: 'storage.backend',
      message: 'Worker-hosted sessions store data on Cloudflare.',
      section: 'hosting',
    };
    const base = baseProps();
    const props = baseProps({
      conflicts: [conflict],
      createPanelProps: { ...base.createPanelProps, conflicts: [conflict] },
    });
    render(<SessionWizardShell {...props} />);

    const hosting = screen.getByTestId('ce-setup-section-hosting');
    expect(screen.getByTestId('ce-setup-more-hosting')).toHaveAttribute('aria-expanded', 'true');
    expect(within(hosting).getByTestId('ce-setup-conflict-worker_authority_requires_cloudflare')).toHaveTextContent(
      conflict.message,
    );
    expect(screen.getByTestId('ce-setup-summary-hosting')).toHaveTextContent('1 conflict');
    expect(screen.getByTestId('ce-setup-more-access')).toHaveAttribute('aria-expanded', 'false');

    const createButton = screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    expect(createButton).toBeDisabled();
    expect(screen.getByTestId('ce-setup-conflicts')).toHaveTextContent(conflict.message);
    fireEvent.click(createButton);
    expect(props.createPanelProps.onCreate).not.toHaveBeenCalled();
  });

  it('routes registry network changes to the page and the profile', () => {
    const base = baseProps();
    const props = baseProps({
      draft: {
        ...base.draft,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED),
      },
      isWorkerCanonical: false,
      registryChainId: 11155420,
    });
    render(<SessionWizardShell {...props} />);

    fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
    fireEvent.change(screen.getByLabelText('Registry network'), { target: { value: '84532' } });

    expect(props.onRegistryChainIdChange).toHaveBeenCalledWith(84532);
    expect(props.editProfile).toHaveBeenCalledTimes(1);
    const [mutate] = jest.mocked(props.editProfile).mock.calls[0];
    const edited = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.TRUSTLESS_PUBLIC_DECENTRALIZED);
    mutate(edited);
    expect(edited.evm.registryChainId).toBe(84532);
  });

  it('shows the end time only for Worker-hosted sessions', () => {
    const { unmount } = render(<SessionWizardShell {...baseProps()} />);
    fireEvent.click(screen.getByTestId('ce-setup-more-participation'));
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_SESSION_ENDS_AT)).toBeInTheDocument();
    unmount();

    render(<SessionWizardShell {...baseProps({ isWorkerCanonical: false })} />);
    fireEvent.click(screen.getByTestId('ce-setup-more-participation'));
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY)).toBeInTheDocument();
    expect(screen.queryByTestId(E2E_TESTIDS.WIZARD_SESSION_ENDS_AT)).not.toBeInTheDocument();
  });

  it('lists missing inputs and runs Create, sign-in and completion through the page handlers', () => {
    const props = baseProps();
    const renderCreate = (createPanelProps: Partial<SessionWizardShellProps['createPanelProps']>) => (
      <SessionWizardShell {...props} createPanelProps={{ ...props.createPanelProps, ...createPanelProps }} />
    );
    const { rerender } = render(renderCreate({ missing: ['Enter a session name.'] }));

    const createButton = screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    expect(screen.getByTestId('ce-setup-missing')).toHaveTextContent('Enter a session name.');
    expect(createButton).toHaveTextContent('Create session');
    expect(createButton).toBeDisabled();

    rerender(renderCreate({}));
    expect(screen.queryByTestId('ce-setup-missing')).not.toBeInTheDocument();
    expect(createButton).not.toBeDisabled();
    fireEvent.click(createButton);
    expect(props.createPanelProps.onCreate).toHaveBeenCalledTimes(1);

    rerender(renderCreate({ stage: 'sign-in' }));
    expect(createButton).toBeDisabled();
    expect(screen.getByTestId('ce-setup-create-stage')).toHaveTextContent('Confirm with your passkey');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.createPanelProps.onCancel).toHaveBeenCalledTimes(1);

    rerender(renderCreate({ completed: true }));
    expect(createButton).toHaveTextContent('Session created');
    expect(createButton).toBeDisabled();
  });

  it('preserves handler wiring for the sponsored status, gates, Worker panel and modals', () => {
    const props = baseProps();
    render(<SessionWizardShell {...props} />);

    fireEvent.click(screen.getByTestId('ce-setup-more-access'));
    fireEvent.click(screen.getByTestId('ce-setup-more-hosting'));
    expect(screen.getByTestId('shell-sponsored-status')).toHaveTextContent('Sponsored bundle loaded.');
    expect(screen.getByTestId('shell-modals')).toHaveAttribute('data-session-slug', 'demo-session');

    fireEvent.click(screen.getByText('retry sponsored bundle'));
    fireEvent.click(screen.getByText('create sbt'));
    fireEvent.click(screen.getByText('generate template setup'));
    fireEvent.click(screen.getByText('close create sbt'));
    fireEvent.click(screen.getByText('close contract'));

    expect(props.sponsoredStatusProps.onRetry).toHaveBeenCalledTimes(1);
    expect(props.encryptionPanelProps.launchCreateSbtModal).toHaveBeenCalledWith({
      targetType: 'gate',
      gateId: 'gate-1',
    });
    expect(props.workerPanelProps.onNativeTemplateSetupGenerated).toHaveBeenCalledWith('generated-identity');
    expect(props.modalsProps.closeCreateSbtModal).toHaveBeenCalledTimes(1);
    expect(props.modalsProps.closeContractViewerModal).toHaveBeenCalledTimes(1);
  });

  // Every rule code shows its plain message beside the option that
  // conflicts, its section opens by itself, and Create stays blocked.
  it.each(Object.entries(RULE_FIXTURES))('shows %s beside its option and blocks Create', (code, profile) => {
    const conflicts = listSessionModeConflicts(profile);
    const conflict = conflicts.find((entry) => entry.code === code) as SessionSetupConflict;
    const base = baseProps();
    render(
      <SessionWizardShell
        {...base}
        draft={{ ...base.draft, sessionModeProfile: profile }}
        conflicts={conflicts}
        createPanelProps={{ ...base.createPanelProps, conflicts }}
      />,
    );

    const section = screen.getByTestId(`ce-setup-section-${conflict.section}`);
    expect(screen.getByTestId(`ce-setup-more-${conflict.section}`)).toHaveAttribute('aria-expanded', 'true');
    const notice = within(section).getByTestId(`ce-setup-conflict-${code}`);
    expect(notice).toHaveTextContent(conflict.message);
    expect(within(screen.getByTestId('ce-setup-conflicts')).getByText(conflict.message, { exact: false })).toBeTruthy();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toBeDisabled();
  });
});
