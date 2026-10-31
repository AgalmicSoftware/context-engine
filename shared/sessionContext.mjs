import { HEX_KEY_HINT, hasHexKey, looksSecret } from './secretText.mjs';

// A session's notes and links ({ title, paragraphs, links }), with the one set
// of limits the session page, MCP, templates and the Worker's set-config share.
// Files and fetched pages are doc-library records, not part of this object.
export const SESSION_CONTEXT_LIMITS = Object.freeze({
  titleChars: 80,
  paragraphs: 6,
  paragraphChars: 2000,
  links: 8,
  labelChars: 120,
  urlChars: 2000,
});

const L = SESSION_CONTEXT_LIMITS;
const KEYS = new Set(['title', 'paragraphs', 'links']);
const LINK_KEYS = new Set(['label', 'url']);

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export const isHttpsUrl = (value) => {
  if (typeof value !== 'string' || !value || value.length > L.urlChars) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * For readers: drops what a writer would refuse and clamps the rest, so stored
 * sessions from before these limits still render. Returns empty lists, never null.
 */
export const normalizeSessionContext = (value) => {
  const context = isRecord(value) ? value : {};
  // Early sessions stored one `body` string instead of paragraphs.
  const paragraphs = (Array.isArray(context.paragraphs) ? context.paragraphs : [context.body])
    .map(text)
    .filter(Boolean)
    .slice(0, L.paragraphs)
    .map((paragraph) => paragraph.slice(0, L.paragraphChars));
  const links = (Array.isArray(context.links) ? context.links : [])
    .filter(isRecord)
    .map((link) => ({ label: text(link.label).slice(0, L.labelChars), url: text(link.url) }))
    .filter((link) => isHttpsUrl(link.url))
    .slice(0, L.links)
    .map((link) => ({ label: link.label || link.url, url: link.url }));
  return { title: text(context.title).slice(0, L.titleChars), paragraphs, links };
};

/** True when there is something to show or give the AI: a paragraph or a link. */
export const hasSessionContext = (value) => {
  const { paragraphs, links } = normalizeSessionContext(value);
  return paragraphs.length > 0 || links.length > 0;
};

const fail = (errors, path, message) => errors.push({ path, message });

/**
 * For writers (setup, the edit page, set-config): refuses wrong types and
 * anything over a limit, and returns the stored form (trimmed text, blank
 * paragraphs and link-less links dropped). null clears the context.
 */
export const validateSessionContext = (value) => {
  if (value === null) return { ok: true, value: null, errors: [] };
  const errors = [];
  if (!isRecord(value)) {
    fail(errors, 'sessionContext', 'Context must be an object with a title, paragraphs and links.');
    return { ok: false, errors };
  }
  Object.keys(value)
    .filter((key) => !KEYS.has(key))
    .forEach((key) => fail(errors, `sessionContext.${key}`, `Context has an unknown field: ${key}.`));
  if (value.title !== undefined && typeof value.title !== 'string') {
    fail(errors, 'sessionContext.title', 'The context title must be text.');
  }
  const title = text(value.title);
  if (title.length > L.titleChars) {
    fail(errors, 'sessionContext.title', `The context title is longer than ${L.titleChars} characters.`);
  }

  const rawParagraphs = value.paragraphs === undefined ? [] : value.paragraphs;
  const paragraphs = [];
  if (!Array.isArray(rawParagraphs)) fail(errors, 'sessionContext.paragraphs', 'Paragraphs must be a list.');
  else {
    rawParagraphs.forEach((paragraph, index) => {
      const path = `sessionContext.paragraphs.${index}`;
      if (typeof paragraph !== 'string') return fail(errors, path, `Paragraph ${index + 1} must be text.`);
      const trimmed = paragraph.trim();
      if (!trimmed) return undefined;
      if (trimmed.length > L.paragraphChars) {
        fail(errors, path, `Paragraph ${index + 1} is longer than ${L.paragraphChars.toLocaleString('en-US')} characters.`);
      }
      paragraphs.push(trimmed);
      return undefined;
    });
    if (paragraphs.length > L.paragraphs) {
      fail(errors, 'sessionContext.paragraphs', `Context holds at most ${L.paragraphs} paragraphs.`);
    }
  }

  const rawLinks = value.links === undefined ? [] : value.links;
  const links = [];
  if (!Array.isArray(rawLinks)) fail(errors, 'sessionContext.links', 'Links must be a list.');
  else {
    rawLinks.forEach((link, index) => {
      const path = `sessionContext.links.${index}`;
      if (!isRecord(link)) return fail(errors, path, `Link ${index + 1} must have a label and a link.`);
      Object.keys(link)
        .filter((key) => !LINK_KEYS.has(key))
        .forEach((key) => fail(errors, `${path}.${key}`, `Link ${index + 1} has an unknown field: ${key}.`));
      if ([link.label, link.url].some((field) => field !== undefined && typeof field !== 'string')) {
        return fail(errors, path, `Link ${index + 1}'s label and link must be text.`);
      }
      const label = text(link.label);
      const url = text(link.url);
      if (!url) return undefined;
      if (url.length > L.urlChars) {
        fail(errors, `${path}.url`, `Link ${index + 1} is longer than ${L.urlChars.toLocaleString('en-US')} characters.`);
      } else if (!isHttpsUrl(url)) fail(errors, `${path}.url`, `Link ${index + 1} must be an https:// link.`);
      if (label.length > L.labelChars) {
        fail(errors, `${path}.label`, `Link ${index + 1}'s label is longer than ${L.labelChars} characters.`);
      }
      links.push({ label, url });
      return undefined;
    });
    if (links.length > L.links) fail(errors, 'sessionContext.links', `Context holds at most ${L.links} links.`);
  }
  // Context is public and read by the AI, so nothing in it may look like a key.
  const SECRET = 'looks like a key, token or password. Remove it: secrets never go in context.';
  const refuse = (path, subject, ...texts) => {
    if (texts.some(hasHexKey)) fail(errors, path, `${subject} ${HEX_KEY_HINT}`);
    else if (texts.some(looksSecret)) fail(errors, path, `${subject} ${SECRET}`);
  };
  refuse('sessionContext.title', 'The title', title);
  paragraphs.forEach((paragraph, index) => refuse(`sessionContext.paragraphs.${index}`, `Paragraph ${index + 1}`, paragraph));
  links.forEach(({ label, url }, index) => refuse(`sessionContext.links.${index}`, `Link ${index + 1}`, label, url));
  return errors.length ? { ok: false, errors } : { ok: true, value: { title, paragraphs, links }, errors };
};

/** One line of plain text (title, paragraphs, link labels) for keyword matching. */
export const sessionContextPlainText = (value) => {
  if (typeof value === 'string') return value.trim();
  const { title, paragraphs, links } = normalizeSessionContext(value);
  return [title, ...paragraphs, ...links.map((link) => link.label)].filter(Boolean).join(' ');
};
