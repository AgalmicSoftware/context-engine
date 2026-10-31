import { applySessionConfigMutation } from '../../../../../workers/sessionCorsWorker/sessionConfigMutation.js';
import { projectPublicWorkerSessionConfig } from '../../../../../workers/shared/workerSessionConfig.mjs';
import { WORKER_CANONICAL_SET_CONFIG_KEYS } from '@ce-shared/sessionConfigEdits.mjs';
import { cloneSessionModePreset, compileSessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import { buildSessionWizardDefaultTemplate } from '../sessionWizardDraftState';
import { applySessionModeProfileSelectionToDraft } from '../sessionWizardModeProfileDraftController';
import { buildSessionWizardWorkerConfigPayload } from '../sessionWizardWriteNormalization';
import { editSessionSetupProfile, setEncryptionMode, setResultsVisibility } from '../setup/sessionSetupProfile';
import { buildSessionSettingsDraft, buildSessionSettingsSave } from './sessionSettingsEdits';

const SLUG = 'edit-salon';
const ADMIN = '0x00000000000000000000000000000000000000aa';
const WORKER_URL = 'https://edit-salon.example.workers.dev';

const workerSave = (existingConfig, incomingConfig) =>
  applySessionConfigMutation({ existingConfig, mutation: { kind: 'set-config', incomingConfig }, slug: SLUG });

// A Worker-hosted session stored the way the setup page publishes it.
const publishedSession = () => {
  const profile = cloneSessionModePreset('fast_cheap_cloudflare');
  const draft = applySessionModeProfileSelectionToDraft(
    buildSessionWizardDefaultTemplate(),
    profile,
    compileSessionModeProfile(profile),
  );
  Object.assign(draft, {
    slug: SLUG,
    sessionName: 'Edit salon',
    sessionInfo: 'Before the salon.',
    interviewMode: { ...draft.interviewMode, openingMode: 'owner', openingPrompt: 'Where do you see the gap?' },
  });
  const config = buildSessionWizardWorkerConfigPayload({
    slug: SLUG,
    draft,
    deployPayload: { adminAddress: ADMIN, allowOrigins: ['https://contextengine.sh'], limits: {}, scopes: {} },
    account: ADMIN,
    sessionId: `0x${'1f'.repeat(16)}`,
    workerUrl: WORKER_URL,
  });
  const created = workerSave(null, config);
  expect(created).toMatchObject({ ok: true });
  return created.config;
};

// The edit page reads the public config, edits it, and saves only the changes.
const editAndSave = (stored, edit) => {
  const before = projectPublicWorkerSessionConfig(stored);
  const draft = buildSessionSettingsDraft(before);
  edit(draft);
  const save = buildSessionSettingsSave(before, draft);
  return { save, result: workerSave(stored, save.patch) };
};

describe('saving the edit page through the Session Worker', () => {
  it('saves name, description and context without signing anyone out', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.sessionName = 'Reverse Alignment';
      draft.sessionInfo = 'Share your views before the salon.';
      draft.sessionContext = { title: 'Context', paragraphs: ['Why this matters.'], links: [] };
    });

    expect(Object.keys(save.patch).sort()).toEqual(['sessionContext', 'sessionInfo', 'sessionName']);
    expect(save.classification).toEqual({
      content: ['sessionName', 'sessionInfo', 'sessionContext'],
      authority: [],
      signsParticipantsOut: false,
    });
    expect(result).toMatchObject({ ok: true });
    expect(result.config).toMatchObject({ sessionName: 'Reverse Alignment', sessionContext: { title: 'Context' } });
    expect(result.config.authzEpoch).toBe(stored.authzEpoch);
  });

  it('keeps an opening-question edit as content, as the Worker does', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.interviewMode = { ...draft.interviewMode, openingPrompt: 'What would you pilot first?' };
    });

    expect(save.patch).toEqual({
      interviewMode: expect.objectContaining({ openingPrompt: 'What would you pilot first?' }),
    });
    expect(save.classification.signsParticipantsOut).toBe(false);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.authzEpoch).toBe(stored.authzEpoch);
  });

  it('previews the sign-out the Worker applies for authority edits', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.groupCreationPolicy = 'admin_only';
      draft.interviewMode = { ...draft.interviewMode, followNewQuestions: true };
      draft.defaultTags = 'democracy, ai';
    });

    expect(save.classification).toEqual({
      content: [],
      authority: expect.arrayContaining(['groupCreationPolicy', 'interviewMode.followNewQuestions', 'defaultTags']),
      signsParticipantsOut: true,
    });
    expect(result).toMatchObject({ ok: true });
    expect(result.config.authzEpoch).not.toBe(stored.authzEpoch);
  });

  it('saves a profile edit with its storage profile, which the Worker accepts', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.sessionModeProfile = editSessionSetupProfile(draft.sessionModeProfile, (profile) => {
        setEncryptionMode(profile, 'none', null);
        setResultsVisibility(profile, 'public_full_if_storage_public');
      }).profile;
    });

    expect(Object.keys(save.patch).sort()).toEqual(['sessionModeProfile', 'storageProfile']);
    expect(save.classification.signsParticipantsOut).toBe(true);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.sessionModeProfile.results.visibility).toBe('public_full_if_storage_public');
  });

  it('sends only fields the Worker accepts, even when every section changes', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      Object.assign(draft, {
        sessionName: 'All changed',
        sessionInfo: 'Every field.',
        sessionHeader: 'https://example.org/header.png',
        appearance: { colorSchemeId: 'ocean' },
        sessionEndsAt: '2099-11-21T02:00',
        sessionContext: { title: 'T', paragraphs: ['P'], links: [{ label: 'L', url: 'https://example.org/' }] },
        defaultTags: 'a, b',
        defaultGroupTags: 'c',
        questionsGenPrompt: 'Prefer concrete next steps.',
        groupCreationPolicy: 'admin_only',
        interviewModeEnabled: false,
        resultsAnalysis: { ...draft.resultsAnalysis, mode: 'manual' },
        ai: { ...draft.ai, reasoningEffort: 'high' },
      });
    });

    Object.keys(save.patch).forEach((key) => expect(WORKER_CANONICAL_SET_CONFIG_KEYS).toContain(key));
    expect(save.patch).not.toHaveProperty('slug');
    expect(save.patch).not.toHaveProperty('corsWorkerUrl');
    expect(result).toMatchObject({ ok: true });
    expect(result.config).toMatchObject({ sessionName: 'All changed', interviewModeEnabled: false });
  });

  it('saves nothing when nothing changed', () => {
    const stored = publishedSession();
    const { save } = editAndSave(stored, () => {});
    expect(save.patch).toEqual({});
    expect(save.classification.signsParticipantsOut).toBe(false);
  });
});
