// An answer's interviewProvenance holds the agent mirror evaluation's material: what the person's AI predicted,
// how sure it was, the answer given before a hidden guess was shown, which fields changed, and the AI's platform
// and model. Only the person who answered and the session's admins read it; everyone else gets the answer
// without it. Stored answers are never rewritten: reads leave it out.

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const normalizeAddress = (value) => String(value || '').trim().toLowerCase();

// Marked, so a reader can tell this copy from an answer stored without the material, and never treat it as the
// author withdrawing it.
export const WITHHELD_FIELD = 'interviewProvenanceWithheld';
const withoutProvenance = (item) => {
  if (!isObj(item) || !Object.prototype.hasOwnProperty.call(item, 'interviewProvenance')) return item;
  const { interviewProvenance: _withheld, ...rest } = item;
  return { ...rest, [WITHHELD_FIELD]: true };
};

/**
 * Whether this caller reads an answer's research material: its author, by the responder the Worker stored at
 * upload, or a session admin. A results admin or a read invite is neither.
 */
export const readsResearchFields = ({ metadata, requesterAddress, authScopes, adminAddresses }) => {
  if (isObj(authScopes) && authScopes.admin === true) return true;
  const address = normalizeAddress(requesterAddress);
  if (!address) return false;
  if (adminAddresses?.has?.(address)) return true;
  return !!normalizeAddress(metadata?.responder) && normalizeAddress(metadata.responder) === address;
};

/**
 * A stored answer payload as this reader may see it. Returns null when nothing was withheld or the payload is
 * not JSON the Worker can read (a client-encrypted payload stays as its audience stored it), so the caller sends
 * the stored bytes unchanged; else { text, withheld }. `carries` says the payload holds research material at all.
 */
export const answerPayloadForReader = (text, { reads }) => {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(parsed)) return null;
  const items = Array.isArray(parsed.responses) ? parsed.responses : null;
  const carries = items ? items.some((item) => isObj(item) && 'interviewProvenance' in item) : 'interviewProvenance' in parsed;
  if (!carries) return null;
  if (reads) return { text, withheld: false, carries };
  const next = items ? { ...parsed, responses: items.map(withoutProvenance) } : withoutProvenance(parsed);
  return { text: JSON.stringify(next), withheld: true, carries };
};
