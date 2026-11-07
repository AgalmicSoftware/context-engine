import { SESSION_TEMPLATE_MAX_BYTES, parseSessionTemplateJson, validateSessionTemplate } from './sessionTemplate.mjs';
import {
  decodeLinkBytes,
  decodeLinkText,
  decodeLinkUtf8,
  deflateLinkBytes,
  encodeBase64Url,
  inflateLinkBytes,
  parseLinkJson,
  readLinkParam,
} from './linkPayload.mjs';

// Links carry a template in the URL fragment, which browsers never send to a
// server. Share links are compact JSON, deflate-raw, then base64url, as
// #template=. An AI can't deflate, so the links it writes are base64url of the
// JSON alone, as #setup=.
const TEMPLATE_PARAM = 'template';
const SETUP_PARAM = 'setup';
// Beyond this a link breaks in chats and mail; offer a .json download instead.
// Decoding refuses longer links too, since no share link is longer.
export const SESSION_TEMPLATE_LINK_MAX_LENGTH = 8000;
// A #setup= link holds at most a whole template, which the JSON check caps.
const SETUP_LINK_MAX_LENGTH = Math.ceil(SESSION_TEMPLATE_MAX_BYTES / 3) * 4;
const TOO_LARGE = `This link's template is larger than ${SESSION_TEMPLATE_MAX_BYTES / 1024} KB.`;
const failure = (message) => ({ ok: false, errors: [{ path: '', message }] });

// { ok: true, fragment } | { ok: false, reason: 'too_long', length } | { ok: false, reason: 'invalid', errors }
export const encodeSessionTemplateLink = async (template) => {
  const checked = validateSessionTemplate(template);
  if (!checked.ok) return { ok: false, reason: 'invalid', errors: checked.errors };
  const json = new TextEncoder().encode(JSON.stringify(checked.template));
  const packed = await deflateLinkBytes(json);
  const fragment = `#${TEMPLATE_PARAM}=${encodeBase64Url(packed)}`;
  return fragment.length > SESSION_TEMPLATE_LINK_MAX_LENGTH
    ? { ok: false, reason: 'too_long', length: fragment.length }
    : { ok: true, fragment };
};

// Broken JSON says whether the link was cut off; whole JSON is then validated.
const readTemplateText = (text) => {
  const parsed = parseLinkJson(text);
  return parsed.ok ? parseSessionTemplateJson(text) : failure(parsed.error);
};

const decodePacked = async (value) => {
  const packed = decodeLinkBytes(value, { maxLength: SESSION_TEMPLATE_LINK_MAX_LENGTH });
  if (!packed.ok) return failure(packed.error);
  let bytes;
  try {
    bytes = await inflateLinkBytes(packed.bytes, SESSION_TEMPLATE_MAX_BYTES);
  } catch {
    return failure('This link is damaged or cut off: its template cannot be unpacked.');
  }
  if (!bytes) return failure(TOO_LARGE);
  const text = decodeLinkUtf8(bytes);
  return text.ok ? readTemplateText(text.text) : failure(text.error);
};

const decodePlain = (value) => {
  const text = decodeLinkText(value, { maxLength: SETUP_LINK_MAX_LENGTH });
  return text.ok ? readTemplateText(text.text) : failure(text.error);
};

/** Whether a fragment carries a template, as #template= or #setup=. */
export const hasSessionTemplateLink = (hash) =>
  readLinkParam(hash, TEMPLATE_PARAM) !== null || readLinkParam(hash, SETUP_PARAM) !== null;

// null when the fragment carries no template; otherwise a template result.
export const decodeSessionTemplateLink = async (hash) => {
  const packed = readLinkParam(hash, TEMPLATE_PARAM);
  if (packed !== null) return decodePacked(packed);
  const plain = readLinkParam(hash, SETUP_PARAM);
  return plain === null ? null : decodePlain(plain);
};
