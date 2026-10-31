import {
  CONTEXT_TAGS,
  CONTEXT_TEXT_ROLE,
  contextFileByteLimit,
  contextRoleOf,
  contextTagValue,
  isAdminsOnlyAccess,
  resolveContextFileType,
} from '../../shared/sessionContextSources.mjs';

const fail = (status, error, reason) => ({ ok: false, status, error, reason });
const POLICY_ERROR = 'Context is for everyone in the session or for admins only; it takes no other access rule.';
const MIB = 1024 * 1024;

// Checks a doc-library upload that carries a context role. Only admins add
// context; the Worker must be able to read it; and links and AI-read text are
// written only by the context route (contextOrigin 'worker', set server-side),
// so a link's snapshot is always one the Worker fetched.
export const checkContextSourceUpload = ({ payload = {}, isAdmin = false, litEncrypted = false } = {}) => {
  const role = contextRoleOf(payload.tags);
  if (!role) return { ok: true, role: '' };
  if (!isAdmin) return fail(403, 'Only session admins can add context.', 'context_admin_required');
  if (payload.payloadEncrypted === true || litEncrypted) {
    return fail(400, 'Context must be readable by the Session Worker, so it cannot be Lit-encrypted.', 'context_encryption_unsupported');
  }
  if (payload.uploadPolicy || payload.groupIds?.length) return fail(400, POLICY_ERROR, 'context_policy_unsupported');
  if (payload.accessConditions && !isAdminsOnlyAccess(payload.accessConditions)) {
    return fail(400, POLICY_ERROR, 'context_policy_unsupported');
  }
  const kind = contextTagValue(payload.tags, CONTEXT_TAGS.kind);
  if (role === CONTEXT_TEXT_ROLE || kind === 'link') {
    return payload.contextOrigin === 'worker'
      ? { ok: true, role }
      : fail(400, 'Links and text read by the session’s AI are added through the context route.', 'context_route_required');
  }
  if (kind !== 'file') return fail(400, 'A context source is a file or a link.', 'context_kind_invalid');
  const type = resolveContextFileType({ type: payload.contentType });
  if (!type) return fail(415, 'Context files are PDF, Markdown, plain text, CSV or JSON.', 'context_type_unsupported');
  const limit = contextFileByteLimit(type);
  if ((payload.bytes?.length || 0) > limit) {
    return fail(413, `This file is larger than ${limit / MIB} MB, the most a context ${type === 'application/pdf' ? 'PDF' : 'text file'} may be.`, 'context_too_large');
  }
  return { ok: true, role };
};

// What a list shows of a context source beyond its tags: the privacy level.
export const contextSourceListFields = (metadata = {}) => (
  metadata?.contextSource === true
    ? { contextSource: true, adminsOnly: isAdminsOnlyAccess(metadata.accessConditions) }
    : {}
);
