import { applySessionConfigMutation } from '../../../../../workers/sessionCorsWorker/sessionConfigMutation.js';
import { projectPublicWorkerSessionConfig } from '../../../../../workers/shared/workerSessionConfig.mjs';
import { WORKER_CANONICAL_SET_CONFIG_KEYS } from '@ce-shared/sessionConfigEdits.mjs';
import { cloneSessionModePreset, compileSessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import { buildSessionWizardDefaultTemplate } from '../sessionWizardDraftState';
import { applySessionModeProfileSelectionToDraft } from '../sessionWizardModeProfileDraftController';
import { buildSessionWizardWorkerConfigPayload } from '../sessionWizardWriteNormalization';
import { editSessionSetupProfile, setEncryptionMode, setResultsVisibility } from '../setup/sessionSetupProfile';
import { normalizeInterviewSettings } from '@ce-shared/interviewSettings.mjs';
import { normalizeResultsAnalysisSettings } from '@ce-shared/resultsAnalysisSettings.mjs';
import { SESSION_TEMPLATE_FORMAT, sessionTemplateFromDraft } from '@ce-shared/sessionTemplate.mjs';
import { SESSION_AGENT_DEFAULT_INSTRUCTIONS } from '@ce-shared/sessionAgent.mjs';
import {
  applyTemplateToSessionSettingsDraft,
  buildSessionSettingsDraft,
  buildSessionSettingsSave,
  describeSessionSettingsPath,
  rebaseSessionSettingsDraft,
} from './sessionSettingsEdits';

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

  it('saves an uploaded HTML context as content, and a blank one in the draft is no change', () => {
    const stored = publishedSession();
    const html = '<h2>Areas</h2><details><summary>Trust</summary><p>Who decides?</p></details>';
    const { save, result } = editAndSave(stored, (draft) => {
      draft.sessionContext = { title: 'Atlas', paragraphs: [], links: [], html };
    });
    expect(Object.keys(save.patch)).toEqual(['sessionContext']);
    expect(save.classification.signsParticipantsOut).toBe(false);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.sessionContext).toEqual({ title: 'Atlas', html, paragraphs: [], links: [] });

    // A page with no title is still the stored context, so another edit doesn't resend it.
    const untitled = { ...stored, sessionContext: { title: '', html, paragraphs: [], links: [] } };
    const renamed = editAndSave(untitled, (draft) => {
      draft.sessionName = 'Renamed';
    });
    expect(Object.keys(renamed.save.patch)).toEqual(['sessionName']);

    const blank = editAndSave(stored, (draft) => {
      draft.sessionContext = { ...draft.sessionContext, html: '' };
    });
    expect(blank.save.patch).not.toHaveProperty('sessionContext');
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

  it('keeps every interview setting edit as content, even turning interviews off', () => {
    const stored = publishedSession();
    const groups = editAndSave(stored, (draft) => {
      draft.interviewMode = {
        ...draft.interviewMode,
        ...normalizeInterviewSettings(draft.interviewMode),
        followNewQuestions: true,
        joinMatchingGroups: true,
        groupSuggestionData: ['country', 'town'],
      };
    });
    expect(groups.save.classification).toEqual({
      content: expect.arrayContaining([
        'interviewMode.followNewQuestions',
        'interviewMode.joinMatchingGroups',
        'interviewMode.groupSuggestionData',
      ]),
      authority: [],
      signsParticipantsOut: false,
    });
    expect(groups.result.config.authzEpoch).toBe(stored.authzEpoch);

    const off = editAndSave(stored, (draft) => {
      draft.interviewModeEnabled = false;
    });
    expect(off.save.patch).toMatchObject({ interviewModeEnabled: false });
    expect(off.save.classification).toMatchObject({ authority: [], signsParticipantsOut: false });
    expect(off.result.config.authzEpoch).toBe(stored.authzEpoch);
  });

  it('previews the sign-out the Worker applies for authority edits', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.groupCreationPolicy = 'admin_only';
      draft.interviewMode = { ...draft.interviewMode, followNewQuestions: true };
      draft.defaultTags = 'democracy, ai';
    });

    expect(save.classification).toEqual({
      content: ['interviewMode.followNewQuestions'],
      authority: expect.arrayContaining(['groupCreationPolicy', 'defaultTags']),
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

  it('saves only the AI parts the admin changed, and the Worker keeps the parts the page cannot see', () => {
    const created = publishedSession();
    const stored = workerSave(created, {
      ai: {
        ...created.ai,
        reasoningEffort: 'high',
        taskReasoningEffort: { generate: 'medium' },
        providers: { custom: { functions: '[{"name":"lookup"}]' } },
      },
    }).config;
    const before = projectPublicWorkerSessionConfig(stored);
    expect(before.ai).not.toHaveProperty('providers');
    const { save, result } = editAndSave(stored, (draft) => {
      draft.ai.reasoningEffort = 'medium';
      draft.ai.taskReasoningEffort = { generate: 'medium', 'interview-map': 'high' };
    });

    expect(save.patch).toEqual({
      ai: { reasoningEffort: 'medium', taskReasoningEffort: { generate: 'medium', 'interview-map': 'high' } },
    });
    expect(save.classification).toEqual({ content: [], authority: ['ai'], signsParticipantsOut: true });
    expect(result).toMatchObject({ ok: true });
    expect(result.config.ai).toEqual({
      ...stored.ai,
      reasoningEffort: 'medium',
      taskReasoningEffort: { generate: 'medium', 'interview-map': 'high' },
    });
    expect(result.config.authzEpoch).not.toBe(stored.authzEpoch);

    // A model edit sends the models alone; a model outside the list is kept as saved.
    const models = editAndSave(result.config, (draft) => {
      draft.ai.models.fast.model = 'gpt-legacy-fast';
    });
    expect(Object.keys(models.save.patch.ai)).toEqual(['models']);
    expect(models.result.config.ai.reasoningEffort).toBe('medium');
    expect(models.result.config.ai.models.fast.model).toBe('gpt-legacy-fast');
  });

  it('leaves AI alone on an older Worker, which replaces ai whole and shows only the models', () => {
    const stored = workerSave(publishedSession(), { ai: { ...publishedSession().ai, reasoningEffort: 'high' } }).config;
    const before = projectPublicWorkerSessionConfig(stored);
    delete before.setConfigMergesAi;
    before.ai = { models: before.ai.models };
    const draft = buildSessionSettingsDraft(before);
    draft.ai.models.fast.model = 'claude-sonnet-5-5';
    expect(buildSessionSettingsSave(before, draft).patch).toEqual({});
  });

  it('keeps the highlighted and hidden lists out of a save to an older Worker, which refuses them', () => {
    const before = projectPublicWorkerSessionConfig(publishedSession());
    delete before.setConfigMergesAi;
    const draft = buildSessionSettingsDraft(before);
    draft.sessionName = 'Renamed';
    draft.lists.BLOCKED_QUESTION_IDS = 'q-1';
    expect(buildSessionSettingsSave(before, draft).patch).toEqual({ sessionName: 'Renamed' });
  });

  it('saves other fields when the stored context fails a newer check, but checks an edited context', () => {
    const before = {
      ...projectPublicWorkerSessionConfig(publishedSession()),
      sessionContext: { title: 'Context', paragraphs: [`Old note: sk-${'a'.repeat(24)}`], links: [] },
    };
    const draft = buildSessionSettingsDraft(before);
    draft.sessionName = 'Renamed';
    expect(buildSessionSettingsSave(before, draft).patch).toEqual({ sessionName: 'Renamed' });

    draft.sessionContext = { ...draft.sessionContext, title: 'Edited' };
    expect(() => buildSessionSettingsSave(before, draft)).toThrow('looks like a key, token or password');
  });

  it('saves an interview voice model edit, but not an unknown model', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.interviewMode = { ...draft.interviewMode, realtimeModel: 'gpt-realtime-2.1' };
    });
    expect(save.patch.interviewMode).toMatchObject({ realtimeModel: 'gpt-realtime-2.1' });
    expect(result).toMatchObject({ ok: true });
    expect(result.config.interviewMode.realtimeModel).toBe('gpt-realtime-2.1');

    const unknown = editAndSave(stored, (draft) => {
      draft.interviewMode = { ...draft.interviewMode, realtimeModel: 'not-a-voice-model' };
    });
    expect(unknown.save.patch).toEqual({});
  });

  it('does not sign anyone out for a profile edit that changes nothing back', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.sessionModeProfile = editSessionSetupProfile(draft.sessionModeProfile, () => {}).profile;
    });
    expect(save.patch).toEqual({});
    expect(result.config.authzEpoch).toBe(stored.authzEpoch);
  });

  it('exports a session saved without results analysis settings', () => {
    const before = projectPublicWorkerSessionConfig(publishedSession());
    delete before.resultsAnalysis;
    const draft = buildSessionSettingsDraft(before);
    expect(draft.resultsAnalysis).toEqual(normalizeResultsAnalysisSettings(undefined));
    expect(sessionTemplateFromDraft(draft)).toMatchObject({ ok: true });
    expect(buildSessionSettingsSave(before, draft).patch).toEqual({});
  });

  it('keeps the session’s own agent access when a template is imported', () => {
    const stored = publishedSession();
    const before = projectPublicWorkerSessionConfig(stored);
    const profile = editSessionSetupProfile(before.sessionModeProfile, (next) => {
      next.surfaces.agentHttp = !before.sessionModeProfile.surfaces.agentHttp;
    }).profile;
    const { draft } = applyTemplateToSessionSettingsDraft(buildSessionSettingsDraft(before), {
      format: SESSION_TEMPLATE_FORMAT,
      sessionModeProfile: profile,
    });
    expect(draft.sessionModeProfile.surfaces.agentHttp).toBe(before.sessionModeProfile.surfaces.agentHttp);
    expect(buildSessionSettingsSave(before, draft).patch).not.toHaveProperty('sessionModeProfile');
  });

  it('leaves who can add context alone when a template is imported, and saves a change without signing anyone out', () => {
    const stored = { ...publishedSession(), contextAdditionPolicy: 'admin_only' };
    const before = projectPublicWorkerSessionConfig(stored);
    const { draft } = applyTemplateToSessionSettingsDraft(buildSessionSettingsDraft(before), {
      format: SESSION_TEMPLATE_FORMAT,
    });
    expect(draft.contextAdditionPolicy).toBe('admin_only');
    expect(buildSessionSettingsSave(before, draft).patch).not.toHaveProperty('contextAdditionPolicy');

    const { save, result } = editAndSave(publishedSession(), (next) => {
      next.contextAdditionPolicy = 'admin_only';
    });
    expect(save.patch).toEqual({ contextAdditionPolicy: 'admin_only' });
    expect(save.classification.signsParticipantsOut).toBe(false);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.contextAdditionPolicy).toBe('admin_only');
  });

  it('saves the most members in a group, and blank puts the default back', () => {
    const stored = publishedSession();
    expect(stored).not.toHaveProperty('groupMemberCeiling');
    const raised = editAndSave(stored, (draft) => {
      expect(draft.groupMemberCeiling).toBe('');
      draft.groupMemberCeiling = '2500';
    });
    expect(raised.save.patch).toEqual({ groupMemberCeiling: 2500 });
    expect(raised.save.classification.signsParticipantsOut).toBe(false);
    expect(raised.result).toMatchObject({ ok: true });
    expect(raised.result.config.groupMemberCeiling).toBe(2500);

    const cleared = editAndSave(raised.result.config, (draft) => {
      expect(draft.groupMemberCeiling).toBe('2500');
      draft.groupMemberCeiling = '';
    });
    expect(cleared.save.patch).toEqual({ groupMemberCeiling: 1000 });
    expect(cleared.result).toMatchObject({ ok: true });

    const before = projectPublicWorkerSessionConfig(stored);
    const draft = buildSessionSettingsDraft(before);
    draft.groupMemberCeiling = '10001';
    expect(() => buildSessionSettingsSave(before, draft)).toThrow(
      'Most members in a group: a whole number from 1 to 10,000.',
    );
  });

  it('saves highlighted and hidden lists, one ID per line, without signing anyone out', () => {
    const stored = publishedSession();
    const questionId = `0x${'ab'.repeat(32)}`;
    const { save, result } = editAndSave(stored, (draft) => {
      draft.lists.HIGHLIGHTED_QUESTION_IDS = `${questionId}\n\n ${questionId.toUpperCase()} \nq-2`;
      draft.lists.BLOCKED_SURVEY_IDS = 'survey-1, survey-2';
    });

    expect(save.patch).toEqual({
      HIGHLIGHTED_QUESTION_IDS: [questionId, 'q-2'],
      BLOCKED_SURVEY_IDS: ['survey-1', 'survey-2'],
    });
    expect(save.classification.signsParticipantsOut).toBe(false);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.authzEpoch).toBe(stored.authzEpoch);

    const before = projectPublicWorkerSessionConfig(result.config);
    const draft = buildSessionSettingsDraft(before);
    expect(draft.lists.HIGHLIGHTED_QUESTION_IDS).toBe(`${questionId}\nq-2`);
    draft.lists.BLOCKED_QUESTION_IDS = 'not an id';
    expect(() => buildSessionSettingsSave(before, draft)).toThrow('Hidden questions: up to 500 IDs, one per line');
  });

  it('saves default filters as a JSON object or a query, and never blocks on an untouched stored value', () => {
    const stored = publishedSession();
    const object = editAndSave(stored, (draft) => {
      draft.defaultFilterState = '{"selectedTags":["housing"]}';
    });
    expect(object.save.patch).toEqual({ defaultFilterState: { selectedTags: ['housing'] } });
    expect(object.result).toMatchObject({ ok: true });

    const query = editAndSave(object.result.config, (draft) => {
      draft.defaultFilterState = 'tag=housing&sort=importance';
    });
    expect(query.save.patch).toEqual({ defaultFilterState: 'tag=housing&sort=importance' });

    const before = projectPublicWorkerSessionConfig(stored);
    const draft = buildSessionSettingsDraft(before);
    draft.defaultFilterState = '{"selectedTags":';
    expect(() => buildSessionSettingsSave(before, draft)).toThrow('Default filters must be a JSON object');

    // A stored value this page would refuse stays as it is while untouched.
    const legacy = { ...before, defaultFilterState: ['legacy'] };
    const untouched = buildSessionSettingsDraft(legacy);
    untouched.sessionName = 'Renamed';
    expect(buildSessionSettingsSave(legacy, untouched).patch).toEqual({ sessionName: 'Renamed' });
  });

  it('saves the pile navigation choice and leaves the deployment default alone otherwise', () => {
    const stored = publishedSession();
    const { save, result } = editAndSave(stored, (draft) => {
      draft.pileAutoAdvanceEnabled = !draft.pileAutoAdvanceEnabled;
    });
    expect(Object.keys(save.patch)).toEqual(['pileAutoAdvanceEnabled']);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.pileAutoAdvanceEnabled).toBe(save.patch.pileAutoAdvanceEnabled);
  });

  it('saves SBT defaults only where SBTs grant access, as the Worker requires', () => {
    const plain = editAndSave(publishedSession(), (draft) => {
      draft.defaultSbtTags = 'members';
      draft.lists.defaultFeaturedSBTs = '0x00000000000000000000000000000000000000f1';
    });
    expect(plain.save.patch).toEqual({});

    // A Worker-hosted session where SBT holders may read, stored as the Worker keeps it.
    const stored = publishedSession();
    const rules = {
      match: 'any',
      conditions: [
        { kind: 'worker_role', role: 'admin' },
        { kind: 'sbt_onchain', chainId: 11155420, contract: `0x${'01'.repeat(20)}`, anyOrAll: 'any' },
      ],
    };
    stored.sessionModeProfile.preset = 'custom';
    stored.sessionModeProfile.evm.registryChainId = 11155420;
    stored.sessionModeProfile.authorization.mechanisms.push('sbt_onchain');
    stored.sessionModeProfile.storage.payloadAccessControl.accessConditions = rules;
    stored.storageProfile.payloadAccessControl.accessConditions = rules;
    const { save, result } = editAndSave(stored, (draft) => {
      draft.defaultSbtTags = 'members';
      draft.lists.defaultFeaturedSBTs = '0x00000000000000000000000000000000000000f1';
      draft.autoFeatureSBTsBySessionSlug = false;
    });
    expect(save.patch).toEqual({
      defaultSbtTags: 'members',
      defaultFeaturedSBTs: ['0x00000000000000000000000000000000000000f1'],
      autoFeatureSBTsBySessionSlug: false,
    });
    expect(result).toMatchObject({ ok: true });
  });

  it('keeps typed edits when a fresh copy of the settings arrives', () => {
    const before = projectPublicWorkerSessionConfig(publishedSession());
    const draft = buildSessionSettingsDraft(before);
    draft.sessionName = 'Typed name';
    draft.ai.reasoningEffort = 'high';
    const fresh = {
      ...before,
      sessionInfo: 'Changed elsewhere',
      ai: { ...before.ai, models: { fast: { model: 'm2' } } },
    };

    const rebased = rebaseSessionSettingsDraft(draft, before, fresh);
    expect(rebased.sessionName).toBe('Typed name');
    expect(rebased.sessionInfo).toBe('Changed elsewhere');
    expect(rebased.ai).toEqual({ ...fresh.ai, reasoningEffort: 'high' });
    expect(buildSessionSettingsSave(fresh, rebased).patch).toEqual({
      sessionName: 'Typed name',
      ai: { reasoningEffort: 'high' },
    });
  });

  it('saves instructions for AI agents as content, clears them, and refuses more than 8,000 characters', () => {
    const stored = publishedSession();
    const instructions = '# Taking part\n\nJoin the Reviewers group.';
    const { save, result } = editAndSave(stored, (draft) => {
      draft.agentInstructions = `  ${instructions}\n`;
    });
    expect(save.patch).toEqual({ agentInstructions: instructions });
    expect(save.classification).toEqual({ content: ['agentInstructions'], authority: [], signsParticipantsOut: false });
    expect(describeSessionSettingsPath('agentInstructions')).toBe('Instructions for AI agents');
    expect(result).toMatchObject({ ok: true, config: { agentInstructions: instructions } });
    expect(result.config.authzEpoch).toBe(stored.authzEpoch);

    const cleared = editAndSave(result.config, (draft) => {
      expect(draft.agentInstructions).toBe(instructions);
      draft.agentInstructions = '';
    });
    expect(cleared.save.patch).toEqual({ agentInstructions: '' });
    expect(cleared.result).toMatchObject({ ok: true, config: { agentInstructions: '' } });

    const before = projectPublicWorkerSessionConfig(stored);
    const draft = { ...buildSessionSettingsDraft(before), agentInstructions: 'x'.repeat(8001) };
    expect(() => buildSessionSettingsSave(before, draft)).toThrow(
      'Instructions for AI agents: up to 8,000 characters.',
    );
  });

  it('keeps an interview setting changed elsewhere while another one is edited here', () => {
    const before = projectPublicWorkerSessionConfig(publishedSession());
    const draft = buildSessionSettingsDraft(before);
    // As Interview settings writes an edit: every setting, then the one changed.
    draft.interviewMode = {
      ...draft.interviewMode,
      ...normalizeInterviewSettings(draft.interviewMode),
      steeringPrompt: 'Listen first.',
    };
    const fresh = { ...before, interviewMode: { ...before.interviewMode, hiddenDraftShare: 0.2 } };

    const rebased = rebaseSessionSettingsDraft(draft, before, fresh);
    expect(buildSessionSettingsSave(fresh, rebased).patch).toEqual({
      interviewMode: { ...fresh.interviewMode, steeringPrompt: 'Listen first.' },
    });
  });

  it('saves what the AI may use for group suggestions only while they are on and it is not the default', () => {
    // As Interview settings writes an edit: every setting, then the ones changed.
    const edit = (changes) => (draft) => {
      draft.interviewMode = { ...draft.interviewMode, ...normalizeInterviewSettings(draft.interviewMode), ...changes };
    };
    const stored = publishedSession();
    const on = editAndSave(stored, edit({ joinMatchingGroups: true }));
    expect(on.save.patch.interviewMode).toMatchObject({ joinMatchingGroups: true });
    expect(on.save.patch.interviewMode).not.toHaveProperty('groupSuggestionData');

    const town = editAndSave(stored, edit({ joinMatchingGroups: true, groupSuggestionData: ['town'] }));
    expect(town.save.patch.interviewMode.groupSuggestionData).toEqual(['town']);
    expect(town.result).toMatchObject({ ok: true });
    expect(editAndSave(stored, edit({ groupSuggestionData: ['town'] })).save.patch).toEqual({});

    const back = editAndSave(town.result.config, edit({ groupSuggestionData: ['country', 'work', 'interests'] }));
    expect(back.save.patch.interviewMode).not.toHaveProperty('groupSuggestionData');
    expect(back.result.config.interviewMode).not.toHaveProperty('groupSuggestionData');

    const off = editAndSave(town.result.config, edit({ joinMatchingGroups: false }));
    expect(off.save.patch.interviewMode).not.toHaveProperty('groupSuggestionData');
    expect(off.result.config.interviewMode).not.toHaveProperty('groupSuggestionData');
  });

  it('saves how many questions a group recording drafts, and when, and the Worker refuses values out of range', () => {
    const edit = (changes) => (draft) => {
      draft.interviewMode = { ...draft.interviewMode, ...normalizeInterviewSettings(draft.interviewMode), ...changes };
    };
    const stored = publishedSession();
    expect(stored.interviewMode).not.toHaveProperty('recordingQuestionCount');
    expect(stored.interviewMode).not.toHaveProperty('recordingQuestionTiming');
    const perChunk = editAndSave(stored, edit({ recordingQuestionCount: 5, recordingQuestionTiming: 'chunk' }));
    expect(perChunk.result).toMatchObject({ ok: true });
    expect(perChunk.result.config.interviewMode).toMatchObject({
      recordingQuestionCount: 5,
      recordingQuestionTiming: 'chunk',
    });
    expect(
      normalizeInterviewSettings(projectPublicWorkerSessionConfig(perChunk.result.config).interviewMode),
    ).toMatchObject({ recordingQuestionCount: 5, recordingQuestionTiming: 'chunk' });
    for (const wrong of [
      { recordingQuestionCount: 11 },
      { recordingQuestionCount: 2.5 },
      { recordingQuestionTiming: 'sometimes' },
    ]) {
      const result = workerSave(stored, { interviewMode: { ...stored.interviewMode, ...wrong } });
      expect(result).toMatchObject({ ok: false });
    }
    const back = editAndSave(
      perChunk.result.config,
      edit({ recordingQuestionCount: 3, recordingQuestionTiming: 'end' }),
    );
    expect(back.save.patch.interviewMode).not.toHaveProperty('recordingQuestionCount');
    expect(back.result.config.interviewMode).not.toHaveProperty('recordingQuestionTiming');
  });

  it('saves the Session Agent as the Worker stores it, without signing anyone out, and turns it off with null', () => {
    const stored = publishedSession();
    expect(stored).not.toHaveProperty('sessionAgent');
    expect(buildSessionSettingsDraft(projectPublicWorkerSessionConfig(stored)).sessionAgent).toBeNull();
    const everyone = {
      who: { match: 'any', conditions: [{ kind: 'agent_grant_scope', scope: 'ai' }] },
      answers: 'general',
    };
    const salon = (groupId) => ({
      who: { match: 'any', conditions: [{ kind: 'worker_group', groupIds: [groupId] }] },
      answers: 'detailed',
    });
    const { save, result } = editAndSave(stored, (draft) => {
      draft.sessionAgent = {
        audiences: [salon(' Salon '), everyone],
        instructions: { general: SESSION_AGENT_DEFAULT_INSTRUCTIONS.general, detailed: ' Cite the files. ' },
      };
    });
    const sessionAgent = { audiences: [salon('salon'), everyone], instructions: { detailed: 'Cite the files.' } };
    expect(save.patch).toEqual({ sessionAgent });
    expect(save.classification.signsParticipantsOut).toBe(false);
    expect(result).toMatchObject({ ok: true });
    expect(result.config.sessionAgent).toEqual(sessionAgent);
    // The page sent the stored form, so reading it back shows no change.
    const reread = projectPublicWorkerSessionConfig(result.config);
    expect(buildSessionSettingsSave(reread, buildSessionSettingsDraft(reread)).patch).toEqual({});

    const off = editAndSave(result.config, (draft) => {
      draft.sessionAgent = null;
    });
    expect(off.save.patch).toEqual({ sessionAgent: null });
    expect(off.result.config).not.toHaveProperty('sessionAgent');
  });

  it('says what to fix in a Session Agent setting before saving', () => {
    const before = projectPublicWorkerSessionConfig(publishedSession());
    const draft = buildSessionSettingsDraft(before);
    draft.sessionAgent = {
      audiences: [{ who: { match: 'any', conditions: [{ kind: 'worker_group', groupIds: [] }] }, answers: 'detailed' }],
    };
    expect(() => buildSessionSettingsSave(before, draft)).toThrow(
      'Session Agent: Audience 1, rule 1, needs at least one group.',
    );
  });

  it('saves nothing when nothing changed', () => {
    const stored = publishedSession();
    const { save } = editAndSave(stored, () => {});
    expect(save.patch).toEqual({});
    expect(save.classification.signsParticipantsOut).toBe(false);
  });
});
