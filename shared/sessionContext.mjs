import { HEX_KEY_HINT, hasHexKey, looksSecret } from './secretText.mjs';

// A session's notes and links ({ title, paragraphs, links }), or instead an
// uploaded HTML page ({ title, html }), with the one set of limits the session
// page, MCP, templates and the Worker's set-config share. Files and fetched
// pages are context sources, not part of this object.
export const SESSION_CONTEXT_LIMITS = Object.freeze({
  titleChars: 80,
  paragraphs: 6,
  paragraphChars: 2000,
  links: 8,
  labelChars: 120,
  urlChars: 2000,
  htmlChars: 20000,
});

const L = SESSION_CONTEXT_LIMITS;
const KEYS = new Set(['title', 'paragraphs', 'links', 'html']);
const LINK_KEYS = new Set(['label', 'url']);

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntity = (match, entity) => {
  const code = /^#x/i.test(entity) ? parseInt(entity.slice(2), 16) : /^#/.test(entity) ? parseInt(entity.slice(1), 10) : NaN;
  if (Number.isInteger(code)) return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
  return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
};

/**
 * The words of some HTML, one line per block, for the AI, MCP and keyword
 * matching. It runs without a DOM, so the Worker can use it too. The result is
 * never rendered, so it only has to read well: the page shows HTML only
 * through the client's sanitizer.
 */
export const htmlToPlainText = (html) =>
  String(html ?? '')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|tr|summary|details|blockquote|pre|table|ul|ol|dt|dd)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

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
 * sessions from before these limits still render. Returns empty lists, never
 * null. Stored HTML replaces the paragraphs and links, as it does for writers.
 * HTML is returned as stored: the page shows it only through its sanitizer.
 */
export const normalizeSessionContext = (value) => {
  const context = isRecord(value) ? value : {};
  const title = text(context.title).slice(0, L.titleChars);
  const html = text(context.html).slice(0, L.htmlChars);
  if (html) return { title, html, paragraphs: [], links: [] };
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
  return { title, paragraphs, links };
};

/** True when there is something to show or give the AI: HTML, a paragraph or a link. */
export const hasSessionContext = (value) => {
  const { html, paragraphs, links } = normalizeSessionContext(value);
  return !!html || paragraphs.length > 0 || links.length > 0;
};

/** The HTML's words, without tags, for the AI; '' when the context is typed text. */
export const sessionContextHtmlText = (value) => htmlToPlainText(normalizeSessionContext(value).html);

const fail = (errors, path, message) => errors.push({ path, message });

/**
 * For writers (setup, the edit page, set-config): refuses wrong types and
 * anything over a limit, and returns the stored form (trimmed text, blank
 * paragraphs and link-less links dropped). Context is either typed text or
 * HTML, never both. null clears the context.
 */
export const validateSessionContext = (value) => {
  if (value === null) return { ok: true, value: null, errors: [] };
  const errors = [];
  if (!isRecord(value)) {
    fail(errors, 'sessionContext', 'Context must be an object with a title, and paragraphs and links or HTML.');
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

  if (value.html !== undefined && typeof value.html !== 'string') {
    fail(errors, 'sessionContext.html', 'The context HTML must be text.');
  }
  const html = text(value.html);
  if (html.length > L.htmlChars) {
    fail(errors, 'sessionContext.html', `The context HTML is longer than ${L.htmlChars.toLocaleString('en-US')} characters.`);
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
  if (html && (paragraphs.length || links.length)) {
    fail(errors, 'sessionContext.html', 'Context is typed text or an HTML file, not both. Remove one of them.');
  }
  // Context is public and read by the AI, so nothing in it may look like a key.
  // HTML is checked as written, attributes included, and as the words the AI reads.
  const SECRET = 'looks like a key, token or password. Remove it: secrets never go in context.';
  const refuse = (path, subject, ...texts) => {
    if (texts.some(hasHexKey)) fail(errors, path, `${subject} ${HEX_KEY_HINT}`);
    else if (texts.some(looksSecret)) fail(errors, path, `${subject} ${SECRET}`);
  };
  refuse('sessionContext.title', 'The title', title);
  if (html) refuse('sessionContext.html', 'The HTML', html, htmlToPlainText(html));
  paragraphs.forEach((paragraph, index) => refuse(`sessionContext.paragraphs.${index}`, `Paragraph ${index + 1}`, paragraph));
  links.forEach(({ label, url }, index) => refuse(`sessionContext.links.${index}`, `Link ${index + 1}`, label, url));
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: html ? { title, html, paragraphs: [], links: [] } : { title, paragraphs, links }, errors };
};

/** One line of plain text (title, HTML words, paragraphs, link labels) for keyword matching. */
export const sessionContextPlainText = (value) => {
  if (typeof value === 'string') return value.trim();
  const { title, html, paragraphs, links } = normalizeSessionContext(value);
  return [title, htmlToPlainText(html).replace(/\s+/g, ' '), ...paragraphs, ...links.map((link) => link.label)]
    .filter(Boolean)
    .join(' ');
};
