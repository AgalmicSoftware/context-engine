// Context sources: files and links added to a session for its AI. They are
// doc-library records (resource docsContext) whose CE-DocRole tag says which:
// 'context' for a file or link someone added, 'context-text' for the text the
// session's AI read from one of those PDFs. Each is for everyone with access
// to the session, for one group, or for admins only.
export const CONTEXT_ROLE = 'context';
export const CONTEXT_TEXT_ROLE = 'context-text';

export const CONTEXT_TAGS = Object.freeze({
  role: 'CE-DocRole',
  kind: 'CE-DocKind',
  name: 'CE-DocName',
  mime: 'CE-DocMime',
  url: 'CE-ContextUrl',
  fetchedAt: 'CE-ContextFetchedAt',
  derivedFrom: 'CE-DocDerivedFromTx',
  readBy: 'CE-ReadBy',
  readModel: 'CE-ReadModel',
  readAt: 'CE-ReadAt',
});

export const CONTEXT_SOURCE_LIMITS = Object.freeze({
  pdfBytes: 20 * 1024 * 1024,
  textFileBytes: 1024 * 1024,
  // A linked page as fetched, before its text is taken out.
  pageBytes: 2 * 1024 * 1024,
  snapshotChars: 100_000,
  // Text the session's AI returns for a PDF.
  readTextChars: 100_000,
  titleChars: 120,
  // A link is also a storage tag, and tag values stop at 1,024 characters.
  urlChars: 1000,
});

// File types a context source may have; others (Office files, images) are refused.
export const CONTEXT_FILE_TYPES = Object.freeze({
  pdf: 'application/pdf',
  md: 'text/markdown',
  markdown: 'text/markdown',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
});
const CONTEXT_FILE_MIMES = new Set(Object.values(CONTEXT_FILE_TYPES));

export const ADMINS_ONLY_ACCESS = Object.freeze({
  match: 'all',
  conditions: Object.freeze([Object.freeze({ kind: 'worker_role', role: 'admin' })]),
});

const text = (value) => (typeof value === 'string' ? value.trim() : '');
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/** Everyone the session admits may add files, unless an admin limits it to admins. */
export const participantsMayAddContext = (config) => config?.contextAdditionPolicy !== 'admin_only';

/** The rule for an item locked to one group: its members may read it, and admins, who may have to remove it. */
export const groupLockedAccess = (groupId) => ({
  match: 'any',
  conditions: [
    { kind: 'worker_role', role: 'admin' },
    { kind: 'worker_group', groupIds: [text(groupId).toLowerCase()] },
  ],
});

/** A tag's value from a storage tag list ({ name, value }[]), or ''. */
export const contextTagValue = (tags, name) =>
  text((Array.isArray(tags) ? tags : []).find((tag) => isRecord(tag) && text(tag.name) === name)?.value);

/** 'context', 'context-text' or '' for anything else in the doc library. */
export const contextRoleOf = (tags) => {
  const role = contextTagValue(tags, CONTEXT_TAGS.role).toLowerCase();
  return role === CONTEXT_ROLE || role === CONTEXT_TEXT_ROLE ? role : '';
};

/** True for exactly the admins-only condition, so the two privacy levels stay unambiguous. */
export const isAdminsOnlyAccess = (accessConditions) => {
  if (!isRecord(accessConditions) || text(accessConditions.match).toLowerCase() !== 'all') return false;
  const conditions = Array.isArray(accessConditions.conditions) ? accessConditions.conditions : [];
  return (
    conditions.length === 1 &&
    isRecord(conditions[0]) &&
    text(conditions[0].kind).toLowerCase() === 'worker_role' &&
    text(conditions[0].role || 'admin').toLowerCase() === 'admin' &&
    Object.keys(conditions[0]).every((key) => key === 'kind' || key === 'role')
  );
};

/** The group an item is locked to, or '' for any other rule, so the privacy levels stay unambiguous. */
export const lockedGroupOf = (accessConditions) => {
  if (!isRecord(accessConditions) || text(accessConditions.match).toLowerCase() !== 'any') return '';
  const conditions = Array.isArray(accessConditions.conditions) ? accessConditions.conditions : [];
  const kindOf = (condition) => (isRecord(condition) ? text(condition.kind).toLowerCase() : '');
  const role = conditions.find((condition) => kindOf(condition) === 'worker_role');
  const group = conditions.find((condition) => kindOf(condition) === 'worker_group');
  const groupIds = Array.isArray(group?.groupIds) ? group.groupIds : [];
  return conditions.length === 2 && role && text(role.role).toLowerCase() === 'admin' && groupIds.length === 1
    ? text(groupIds[0]).toLowerCase()
    : '';
};

/** A file's content type from its type or name, when context sources accept it; else ''. */
export const resolveContextFileType = ({ name = '', type = '' } = {}) => {
  const declared = text(type).split(';')[0].toLowerCase();
  if (CONTEXT_FILE_MIMES.has(declared)) return declared;
  const extension = /\.([a-z0-9]+)$/i.exec(text(name))?.[1]?.toLowerCase() || '';
  return Object.hasOwn(CONTEXT_FILE_TYPES, extension) ? CONTEXT_FILE_TYPES[extension] : '';
};

/** The most bytes a context file of this type may have. */
export const contextFileByteLimit = (contentType) =>
  contentType === CONTEXT_FILE_TYPES.pdf ? CONTEXT_SOURCE_LIMITS.pdfBytes : CONTEXT_SOURCE_LIMITS.textFileBytes;
