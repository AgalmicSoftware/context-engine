const LOCKED_FIELD_MASK = '[encrypted]';

const isObj = (value) => (
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const getTargets = (payload) => (
  isObj(payload?.encryption?.targets) ? payload.encryption.targets : {}
);

const getEncryptedFields = (payload) => (
  isObj(payload?.encryptedFields) ? payload.encryptedFields : {}
);

const hasEnvelope = (value) => {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const isTargetEnabled = (targets, aliases) => (
  aliases.some((alias) => targets?.[alias] === true)
);

const hasAliasEnvelope = (payload, aliases) => (
  aliases.some((alias) => hasEnvelope(payload?.[alias]))
);

const isNeutralLockedValue = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === '*' || trimmed === LOCKED_FIELD_MASK;
  }
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const formatPath = (path, field) => (path ? `${path}.${field}` : field);

const buildLeakError = (path, field) => (
  new Error(`Locked payload plaintext leak: ${formatPath(path, field)} must be neutral when encrypted.`)
);

const assertNeutralWhenLocked = ({
  payload,
  field,
  path,
  encryptedField = field,
  encryptedAliases = [],
  targetAliases = [field],
}) => {
  if (!isObj(payload)) return;
  const encryptedFields = getEncryptedFields(payload);
  const targets = getTargets(payload);
  const locked =
    hasEnvelope(encryptedFields?.[encryptedField]) ||
    hasAliasEnvelope(payload, encryptedAliases) ||
    isTargetEnabled(targets, targetAliases);
  if (!locked) return;
  if (!isNeutralLockedValue(payload[field])) {
    throw buildLeakError(path, field);
  }
};

const assertResponseFieldNoLeak = (field, path) => {
  if (!isObj(field)) return;
  const encrypted = field.encrypted === true || hasEnvelope(field.encryptedPortion);
  if (!encrypted) return;
  if (!isNeutralLockedValue(field.value)) {
    throw buildLeakError(path, 'value');
  }
};

const assertResponseEntryNoLeak = (entry, path) => {
  if (!isObj(entry)) return;
  assertResponseFieldNoLeak(entry.answer, formatPath(path, 'answer'));
  assertResponseFieldNoLeak(entry.additional, formatPath(path, 'additional'));

  [
    ['importance', 'importanceEncrypted'],
    ['conviction', 'convictionEncrypted'],
  ].forEach(([field, envelopeField]) => {
    if (hasEnvelope(entry[envelopeField]) && !isNeutralLockedValue(entry[field])) {
      throw buildLeakError(path, field);
    }
  });
};

const validateSurveyMetadataNoLeak = (payload, path) => {
  assertNeutralWhenLocked({
    payload,
    field: 'title',
    path,
    encryptedField: 'title',
    encryptedAliases: ['titleEncrypted', 'encryptedTitle'],
    targetAliases: ['survey', 'title'],
  });
  assertNeutralWhenLocked({
    payload,
    field: 'documentURLs',
    path,
    encryptedField: 'documentURLs',
    encryptedAliases: ['documentURLsEncrypted', 'docUrlsEncrypted', 'encryptedDocumentURLs', 'encryptedDocUrls'],
    targetAliases: ['docUrls', 'documentURLs'],
  });
};

const validateQuestionMetadataNoLeak = (payload, path) => {
  assertNeutralWhenLocked({
    payload,
    field: 'prompt',
    path,
    encryptedField: 'prompt',
    encryptedAliases: ['promptEncrypted', 'encryptedPrompt'],
    targetAliases: ['questions', 'prompt'],
  });
  assertNeutralWhenLocked({
    payload,
    field: 'options',
    path,
    encryptedField: 'options',
    encryptedAliases: ['optionsEncrypted', 'encryptedOptions'],
    targetAliases: ['questions', 'options'],
  });
  assertNeutralWhenLocked({
    payload,
    field: 'tags',
    path,
    encryptedField: 'tags',
    encryptedAliases: ['tagsEncrypted', 'encryptedTags'],
    targetAliases: ['questionTags', 'tags'],
  });
  assertNeutralWhenLocked({
    payload,
    field: 'documentURLs',
    path,
    encryptedField: 'documentURLs',
    encryptedAliases: ['documentURLsEncrypted', 'docUrlsEncrypted', 'encryptedDocumentURLs', 'encryptedDocUrls'],
    targetAliases: ['docUrls', 'documentURLs'],
  });
};

const validateSbtMetadataNoLeak = (payload, path) => {
  [
    ['name', ['nameEncrypted', 'encryptedName']],
    ['description', ['descriptionEncrypted', 'encryptedDescription']],
    ['tags', ['tagsEncrypted', 'encryptedTags']],
    ['documentURLs', ['documentURLsEncrypted', 'docUrlsEncrypted', 'encryptedDocumentURLs', 'encryptedDocUrls']],
    ['image', ['imageEncrypted', 'encryptedImage']],
  ].forEach(([field, aliases]) => {
    assertNeutralWhenLocked({
      payload,
      field,
      path,
      encryptedField: field,
      encryptedAliases: aliases,
      targetAliases: [field],
    });
  });
};

export const validateNoLockedPlaintextInPayload = (
  payload,
  { family = 'auto', path = 'payload' } = {}
) => {
  if (!isObj(payload)) return payload;

  const resolvedFamily = (() => {
    if (family && family !== 'auto') return family;
    if (Array.isArray(payload.responses)) return 'survey_response_payload';
    if (isObj(payload.answer) || isObj(payload.additional)) return 'question_response_payload';
    if (hasOwn(payload, 'surveyID') || hasOwn(payload, 'questionIDs') || hasOwn(payload, 'title')) return 'survey_metadata';
    if (hasOwn(payload, 'prompt') || hasOwn(payload, 'options')) return 'question_metadata';
    if (isObj(payload.encryptedFields)) return 'sbt_metadata';
    return 'generic';
  })();

  if (resolvedFamily === 'survey_metadata') {
    validateSurveyMetadataNoLeak(payload, path);
  } else if (resolvedFamily === 'question_metadata') {
    validateQuestionMetadataNoLeak(payload, path);
  } else if (resolvedFamily === 'question_response_payload') {
    assertResponseEntryNoLeak(payload, path);
  } else if (resolvedFamily === 'survey_response_payload') {
    assertResponseEntryNoLeak(payload, path);
    (Array.isArray(payload.responses) ? payload.responses : []).forEach((entry, index) => {
      assertResponseEntryNoLeak(entry, `${path}.responses[${index}]`);
    });
  } else if (resolvedFamily === 'sbt_metadata') {
    validateSbtMetadataNoLeak(payload, path);
  }

  return payload;
};

export const sanitizeQuestionPromptForResponsePayload = (
  question,
  { isLocked = false } = {}
) => {
  const locked =
    isLocked ||
    hasEnvelope(question?.promptEncrypted) ||
    hasEnvelope(question?.encryptedPrompt) ||
    isTargetEnabled(getTargets(question), ['questions', 'prompt']);
  if (locked) return LOCKED_FIELD_MASK;
  return question?.prompt ?? '';
};

export const sanitizeSurveyTitleForResponsePayload = (
  survey,
  { isLocked = false } = {}
) => {
  const locked =
    isLocked ||
    hasEnvelope(survey?.titleEncrypted) ||
    hasEnvelope(survey?.encryptedTitle) ||
    isTargetEnabled(getTargets(survey), ['survey', 'title']);
  if (locked) return LOCKED_FIELD_MASK;
  return survey?.title ?? null;
};

export { LOCKED_FIELD_MASK };
