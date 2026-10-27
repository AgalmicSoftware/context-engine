import { safeString, lower, sanitizeSessionSlug } from './runtimePrimitives.mjs';
import { normalizeQuestionTags } from './agentQuestionProposals.mjs';
import { isHostedAgentHttpSession } from './sessionPolicy.mjs';
import { assertNoSecretShape } from './redaction.mjs';
import { loadAgentLightweightGroups, persistAgentChildSession, persistAgentLightweightGroupProposal, saveAgentLightweightGroupMembership } from './agentGroups.mjs';
import { loadAgentSettings, saveAgentSettingsPatch } from './agentSettings.mjs';
import { AGENT_ONBOARDING_QUESTIONS } from './httpConstants.mjs';
import { json, normalizeBoolean } from './httpInput.mjs';

export function onboardingAnswersFromSettings(settings = {}) {
  const uses = new Set(Array.isArray(settings.allowedUses) ? settings.allowedUses : []);
  const profileFields = new Set(Array.isArray(settings.allowedProfileFields) ? settings.allowedProfileFields : []);
  return {
    preference_tailoring:
      uses.has('rank_questions') ||
      profileFields.has('interests') ||
      profileFields.has('sessions_attended') ||
      profileFields.has('roles'),
    demographics_research: uses.has('research_demographics') || profileFields.has('non_identifying_demographics'),
    demographic_link_opt_in: settings.demographicLinkOptIn === true || uses.has('link_demographics_research'),
    attendance_context_opt_in:
      settings.attendanceLinkOptIn === true ||
      uses.has('link_attendance_context') ||
      profileFields.has('edge_attendance'),
    draft_responses: uses.has('draft_answers'),
    draft_divergence_research: settings.draftDivergenceOptIn === true || uses.has('research_draft_divergence'),
    auto_apply_question_votes: settings.agentAutoApplyQuestionVotes === true,
    edge_daily_digest: settings.dailyDigestOptIn === true,
  };
}

export function normalizeOnboardingTopicPreferences(input = {}, settings = {}) {
  const source =
    input.topicPreferences ||
    input.topics ||
    input.interests ||
    input.answers?.topic_preferences ||
    settings.topicPreferences ||
    [];
  return normalizeQuestionTags(source).slice(0, 30);
}

export function plainObject(value = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function collectProfileTextParts(value, depth = 0) {
  if (depth > 3 || value === undefined || value === null) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = safeString(value);
    return text ? [text.slice(0, 500)] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectProfileTextParts(entry, depth + 1)).slice(0, 40);
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .flatMap(([key, entry]) => [
        ...(entry === true ? [safeString(key)] : []),
        ...collectProfileTextParts(entry, depth + 1),
      ])
      .filter(Boolean)
      .slice(0, 60);
  }
  return [];
}

export function onboardingProfileSources(input = {}) {
  const answers = plainObject(input.answers);
  return [
    input.profile,
    input.edgeProfile,
    input.userProfile,
    input.authorizedProfile,
    input.profileSummary,
    input.bio,
    input.userBio,
    input.edgeBio,
    answers.profile,
    answers.edgeProfile,
    answers.bio,
  ];
}

export function onboardingProfileText(input = {}) {
  return onboardingProfileSources(input)
    .flatMap((source) => collectProfileTextParts(source))
    .join(' ')
    .toLowerCase();
}

export function explicitProfileRoleText(input = {}) {
  const sources = onboardingProfileSources(input).filter(
    (source) => source && typeof source === 'object' && !Array.isArray(source),
  );
  const values = [];
  for (const source of sources) {
    values.push(
      source.role,
      source.roles,
      source.contributionRole,
      source.contribution_role,
      source.edgeRole,
      source.edge_role,
    );
  }
  return collectProfileTextParts(values).join(', ').slice(0, 80);
}

export function inferAttendanceSelectionsFromProfile(input = {}) {
  const text = onboardingProfileText(input);
  const selected = [];
  if (/\b(?:week|wk|w)[\s_-]*1\b|\bfirst\s+week\b/.test(text)) selected.push('week_1');
  if (/\b(?:week|wk|w)[\s_-]*2\b|\bsecond\s+week\b/.test(text)) selected.push('week_2');
  if (/\b(?:week|wk|w)[\s_-]*3\b|\bthird\s+week\b/.test(text)) selected.push('week_3');
  if (/\b(?:week|wk|w)[\s_-]*4\b|\bfourth\s+week\b/.test(text)) selected.push('week_4');
  if (/\b(?:entire|whole|full)\s+month\b|\ball\s+(?:month|four|4)\b|\bmonth[-\s]*long\b/.test(text)) {
    selected.push('entire_month');
  }
  if (
    /\bprevious\s+edge\b|\bpast\s+edge\b|\battended\s+edge\s+(?:before|previously)\b|\battended\s+previous\s+edge\b/.test(
      text,
    )
  ) {
    selected.push('attended_previous_edge_events');
  }
  return [...new Set(selected)];
}

export function inferContributionRoleSelectionsFromProfile(input = {}) {
  const text = onboardingProfileText(input);
  const selected = [];
  if (/\b(?:researcher|research|scientist|academic|scholar)\b/.test(text)) selected.push('researcher');
  if (/\b(?:builder|engineer|developer|hacker|protocol|infrastructure|infra)\b/.test(text)) selected.push('builder');
  if (/\b(?:founder|operator|startup|operations|product)\b/.test(text)) selected.push('founder_operator');
  if (/\b(?:investor|vc|venture|fund)\b/.test(text)) selected.push('investor');
  if (/\b(?:artist|designer|creative)\b/.test(text)) selected.push('artist_designer');
  if (/\b(?:community|host|organizer|organiser|facilitator|program\s+lead|event\s+lead)\b/.test(text))
    selected.push('community_host');
  if (!selected.length) {
    const explicitRole = explicitProfileRoleText(input);
    if (explicitRole) selected.push('other');
  }
  return [...new Set(selected)];
}

export function inferOnboardingGroupMembershipInput(input = {}, allowedCategories = new Set()) {
  const selections = {};
  const details = {};
  if (allowedCategories.has('events_attended')) {
    const attendance = inferAttendanceSelectionsFromProfile(input);
    if (attendance.length) selections.events_attended = attendance;
  }
  if (allowedCategories.has('contribution_role')) {
    const roles = inferContributionRoleSelectionsFromProfile(input);
    if (roles.length) {
      selections.contribution_role = roles;
      if (roles.includes('other')) {
        const roleText = explicitProfileRoleText(input);
        if (roleText) details.contribution_role = { other_text: roleText };
      }
    }
  }
  return { selections, details };
}

export function mergeOnboardingSelections(...sources) {
  const merged = {};
  for (const source of sources) {
    for (const [category, values] of Object.entries(source || {})) {
      const entries = Array.isArray(values) ? values : [values];
      const existing = Array.isArray(merged[category]) ? merged[category] : [];
      merged[category] = [...new Set([...existing, ...entries.map(safeString).filter(Boolean)])].slice(0, 12);
    }
  }
  return merged;
}

export function normalizeOnboardingGroupMembershipInput(input = {}, answers = {}) {
  const groups = plainObject(input.groups);
  const rawSelections = plainObject(
    input.groupSelections || input.bucketSelections || input.demographicBuckets || groups.selections,
  );
  const rawDetails = plainObject(
    input.groupDetails || input.bucketDetails || input.demographicDetails || groups.details,
  );
  const allowedCategories = new Set();
  if (answers.demographic_link_opt_in === true || answers.demographics_research === true) {
    ['age_bucket', 'country_relationship', 'region', 'ai_tribe', 'contribution_role'].forEach((id) =>
      allowedCategories.add(id),
    );
  }
  if (answers.attendance_context_opt_in === true) {
    allowedCategories.add('events_attended');
  }
  const inferred = inferOnboardingGroupMembershipInput(input, allowedCategories);
  const selections = {};
  for (const [categoryId, value] of Object.entries(rawSelections)) {
    const category = safeString(categoryId);
    if (!allowedCategories.has(category)) continue;
    const values = Array.isArray(value) ? value : safeString(value).split(/[\n,;|]+/);
    const normalized = values
      .map((entry) =>
        safeString(entry)
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '')
          .slice(0, 80),
      )
      .filter(Boolean)
      .slice(0, 12);
    if (normalized.length) selections[category] = [...new Set(normalized)];
  }
  Object.assign(selections, mergeOnboardingSelections(inferred.selections, selections));
  const details = {};
  for (const [categoryId, value] of Object.entries(rawDetails)) {
    const category = safeString(categoryId);
    if (!allowedCategories.has(category)) continue;
    if (Array.isArray(value)) {
      details[category] = value.map(safeString).filter(Boolean).slice(0, 8);
    } else if (value && typeof value === 'object') {
      details[category] = Object.fromEntries(
        Object.entries(value)
          .map(([key, entry]) => [safeString(key).slice(0, 64), safeString(entry).slice(0, 160)])
          .filter(([key, entry]) => key && entry)
          .slice(0, 12),
      );
    } else {
      const detail = safeString(value).slice(0, 160);
      if (detail) details[category] = detail;
    }
  }
  for (const [category, value] of Object.entries(inferred.details || {})) {
    if (!allowedCategories.has(category) || details[category]) continue;
    details[category] = value;
  }
  return { selections, details };
}

export function hasOnboardingGroupMembership(input = {}) {
  return Object.keys(input.selections || {}).length > 0 || Object.keys(input.details || {}).length > 0;
}

export function onboardingGroupFollowUpQuestions({ answers = {}, groups = {} } = {}) {
  const selections = plainObject(groups.selections);
  const questions = [];
  if (answers.attendance_context_opt_in === true && !Array.isArray(selections.events_attended)) {
    questions.push({
      categoryId: 'events_attended',
      prompt:
        'Which Edge weeks are you attending: Week 1, Week 2, Week 3, Week 4, or Entire Month? Have you attended previous Edge events?',
    });
  }
  if (
    (answers.demographic_link_opt_in === true || answers.demographics_research === true) &&
    !Array.isArray(selections.contribution_role)
  ) {
    questions.push({
      categoryId: 'contribution_role',
      prompt:
        'What role best describes you for research: builder, researcher, founder/operator, investor, artist/designer, community host, or other?',
    });
  }
  return questions;
}

export function normalizeOnboardingAnswers(input = {}, settings = {}) {
  const source =
    input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers : input;
  const previous = onboardingAnswersFromSettings(settings);
  const answers = AGENT_ONBOARDING_QUESTIONS.reduce((result, question) => {
    result[question.id] = normalizeBoolean(
      Object.hasOwn(source, question.id) ? source[question.id] : undefined,
      previous[question.id] === true ? true : false,
    );
    return result;
  }, {});
  const combinedResearchLink = normalizeBoolean(
    Object.hasOwn(source, 'demographic_link_opt_in') ? source.demographic_link_opt_in : undefined,
    previous.demographic_link_opt_in === true ||
      previous.demographics_research === true ||
      previous.attendance_context_opt_in === true,
  );
  answers.demographic_link_opt_in = combinedResearchLink;
  answers.demographics_research = normalizeBoolean(
    Object.hasOwn(source, 'demographics_research') ? source.demographics_research : undefined,
    combinedResearchLink,
  );
  answers.attendance_context_opt_in = normalizeBoolean(
    Object.hasOwn(source, 'attendance_context_opt_in') ? source.attendance_context_opt_in : undefined,
    combinedResearchLink,
  );
  return answers;
}

export function settingsPatchFromOnboardingAnswers(answers = {}, completedAt = '') {
  const allowedProfileFields = [];
  const allowedUses = [];
  if (answers.preference_tailoring === true) {
    allowedProfileFields.push('interests', 'sessions_attended', 'roles');
    allowedUses.push('rank_questions');
  }
  if (answers.demographics_research === true) {
    allowedProfileFields.push('non_identifying_demographics');
    allowedUses.push('research_demographics');
  }
  if (answers.demographic_link_opt_in === true) {
    allowedProfileFields.push('edge_bio_keywords', 'age_bucket', 'country', 'region', 'roles');
    allowedUses.push('link_demographics_research');
  }
  if (answers.attendance_context_opt_in === true) {
    allowedProfileFields.push('edge_attendance');
    allowedUses.push('link_attendance_context');
  }
  if (answers.draft_responses === true) {
    allowedUses.push('draft_answers');
  }
  if (answers.draft_divergence_research === true) {
    allowedUses.push('research_draft_divergence');
  }
  if (answers.auto_apply_question_votes === true) {
    allowedUses.push('recommend_votes');
  }
  return {
    allowedProfileFields: [...new Set(allowedProfileFields)],
    allowedUses: [...new Set(allowedUses)],
    demographicLinkOptIn: answers.demographic_link_opt_in === true,
    attendanceLinkOptIn: answers.attendance_context_opt_in === true,
    draftDivergenceOptIn: answers.draft_divergence_research === true,
    approvalMode: {
      answers: answers.draft_responses === true ? 'draft_for_review' : 'manual_review',
      questionVotes: answers.auto_apply_question_votes === true ? 'auto_apply' : 'suggest_for_review',
      groups: 'suggest_for_review',
    },
    agentAutoApplyQuestionVotes: answers.auto_apply_question_votes === true,
    dailyDigestOptIn: answers.edge_daily_digest === true,
    onboardingCompletedAt: completedAt,
  };
}

export function normalizeOnboardingDigestTimeOfDay(input = {}, settings = {}) {
  const raw =
    input.digestTimeOfDay ||
    input.digestWindow ||
    input.digestTime ||
    input.answers?.digest_time_of_day ||
    input.answers?.digestTimeOfDay ||
    settings.digestTimeOfDay ||
    'morning';
  const value = lower(raw);
  if (['night', 'evening', 'pm'].includes(value)) return 'night';
  return 'morning';
}

export function publicOnboardingState({ sessionSlug = '', settings = {}, groups = null } = {}) {
  const answers = onboardingAnswersFromSettings(settings);
  const questions = AGENT_ONBOARDING_QUESTIONS.map((question, index) => ({
    ...question,
    order: index + 1,
    answer: answers[question.id] === true,
  }));
  const groupFollowUpQuestions = onboardingGroupFollowUpQuestions({
    answers,
    groups: groups || {},
  });
  const payload = {
    ok: true,
    sessionSlug: sanitizeSessionSlug(sessionSlug),
    completed: Boolean(safeString(settings.onboardingCompletedAt)),
    completedAt: safeString(settings.onboardingCompletedAt),
    questions,
    answers,
    topicPreferences: Array.isArray(settings.topicPreferences) ? settings.topicPreferences : [],
    ...(groups ? { groups } : {}),
    ...(groupFollowUpQuestions.length ? { groupFollowUpQuestions } : {}),
    settings: {
      allowedProfileFields: Array.isArray(settings.allowedProfileFields) ? settings.allowedProfileFields : [],
      allowedUses: Array.isArray(settings.allowedUses) ? settings.allowedUses : [],
      topicPreferences: Array.isArray(settings.topicPreferences) ? settings.topicPreferences : [],
      demographicLinkOptIn: settings.demographicLinkOptIn === true,
      attendanceLinkOptIn: settings.attendanceLinkOptIn === true,
      draftDivergenceOptIn: settings.draftDivergenceOptIn === true,
      approvalMode: settings.approvalMode || {},
      agentAutoApplyQuestionVotes: settings.agentAutoApplyQuestionVotes === true,
      dailyDigestOptIn: settings.dailyDigestOptIn === true,
      digestTimeOfDay: safeString(settings.digestTimeOfDay) || 'morning',
    },
  };
  assertNoSecretShape(payload, "Agent onboarding state must not serialize secrets.");
  return payload;
}

export async function handleOnboardingRequest({ env = {}, context = {}, input = {}, body = {}, method = 'GET' } = {}) {
  const sessionSlug = context.session.sessionSlug;
  const telegramUserId = context.storageContext.user.telegramUserId;
  const current = await loadAgentSettings({
    env,
    sessionSlug,
    telegramUserId,
  });
  if (safeString(method).toUpperCase() !== 'POST') {
    const groups = await loadAgentLightweightGroups({
      env,
      session: context.session,
      telegramUserId,
      accountAddress: context.delegation?.accountAddress || body.accountAddress || '',
    });
    return json(publicOnboardingState({ sessionSlug, settings: current, groups }));
  }
  const completedAt = safeString(input.completedAt || input.createdAt) || new Date().toISOString();
  const answers = normalizeOnboardingAnswers(body, current);
  const patch = {
    ...settingsPatchFromOnboardingAnswers(answers, completedAt),
    topicPreferences: answers.preference_tailoring === true ? normalizeOnboardingTopicPreferences(body, current) : [],
    digestTimeOfDay:
      answers.edge_daily_digest === true
        ? normalizeOnboardingDigestTimeOfDay(body, current)
        : current.digestTimeOfDay || 'morning',
  };
  const groupMembership = normalizeOnboardingGroupMembershipInput(body, answers);
  let savedGroups = null;
  if (hasOnboardingGroupMembership(groupMembership)) {
    savedGroups = await saveAgentLightweightGroupMembership({
      env,
      session: context.session,
      telegramUserId,
      accountAddress: context.delegation?.accountAddress || body.accountAddress || '',
      selections: groupMembership.selections,
      details: groupMembership.details,
      createdAt: completedAt,
    });
  }
  const saved = await saveAgentSettingsPatch({
    env,
    sessionSlug,
    telegramUserId,
    patch,
    createdAt: completedAt,
  });
  if (!saved.ok) {
    return json(
      {
        ok: false,
        reason: saved.reason || 'onboarding_settings_save_failed',
      },
      { status: 400 },
    );
  }
  const payload = {
    ...publicOnboardingState({
      sessionSlug,
      settings: saved.settings,
      groups: savedGroups?.ok ? savedGroups.groups : null,
    }),
  };
  assertNoSecretShape(payload, "Agent onboarding save response must not serialize secrets.");
  return json(payload);
}

export function hostedAgentHttpRouteGuard(context = {}) {
  if (isHostedAgentHttpSession(context.session)) return null;
  return json(
    {
      ok: false,
      reason: 'hosted_agent_http_session_required',
      sessionSlug: context.session?.sessionSlug || '',
    },
    { status: 403 },
  );
}

export async function handleGroupsRequest({ env = {}, context = {} } = {}) {
  const guard = hostedAgentHttpRouteGuard(context);
  if (guard) return guard;
  const groups = await loadAgentLightweightGroups({
    env,
    session: context.session,
    telegramUserId: context.storageContext.user.telegramUserId,
  });
  return json({
    ok: true,
    sessionSlug: context.session.sessionSlug,
    permissionMode: context.permission.mode,
    groups,
  });
}

export async function handleGroupProposalRequest({ env = {}, context = {}, input = {} } = {}) {
  const guard = hostedAgentHttpRouteGuard(context);
  if (guard) return guard;
  const saved = await persistAgentLightweightGroupProposal({
    env,
    session: context.session,
    normalized: context.storageContext,
    input,
    metadata: {
      source: 'agent_handoff',
      authMode: safeString(context.authMode),
      endpoint: '/api/agent/groups/propose',
    },
    createdAt: input.createdAt || null,
  });
  return json(saved, { status: saved.ok ? 200 : 400 });
}

export async function handleChildSessionRequest({ env = {}, context = {}, input = {} } = {}) {
  const guard = hostedAgentHttpRouteGuard(context);
  if (guard) return guard;
  const saved = await persistAgentChildSession({
    env,
    parentSession: context.session,
    normalized: context.storageContext,
    input,
    createdAt: input.createdAt || null,
  });
  return json(saved, { status: saved.ok ? 200 : 400 });
}
