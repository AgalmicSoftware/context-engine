import DOMPurify from 'dompurify';

// What an uploaded context page may keep: text structure, https links and
// images, tables, and details/summary sections that open in place. The rest
// goes, style and class included, so the site's theme styles what is left.
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'blockquote',
  'pre',
  'code',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'small',
  'sub',
  'sup',
  'mark',
  'span',
  'div',
  'a',
  'img',
  'figure',
  'figcaption',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'details',
  'summary',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'open'];
const CONFIG = { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false };

// Its own instance, so no other library's hooks or settings reach it.
let purifier: ReturnType<typeof DOMPurify> | null = null;
const getPurifier = () => {
  purifier = purifier || DOMPurify(window);
  return purifier;
};

const isHttps = (value: string | null) => {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export type CleanContextHtml = {
  /** The HTML that may be shown: run it through here at every render. */
  html: string;
  /** What was taken out, as short labels such as `<script>` or `style`; empty when nothing was. */
  removed: string[];
};

// Names for attributes whose removal reads better as what it means.
const ATTRIBUTE_LABELS: Record<string, string> = { href: 'links that aren’t https', src: 'images that aren’t https' };
// Every https link gets its own target and rel, so the author's are replaced, not lost.
const REPLACED_ATTRIBUTES = new Set(['target', 'rel']);

// The parser files a page's head, and anything before its first text, away
// from the body DOMPurify cleans, so what was there is found separately.
// DOMParser runs no scripts, and nothing it builds is shown.
const headExtras = (input: string) => {
  const head = new DOMParser().parseFromString(input, 'text/html').head;
  return [...head.querySelectorAll('script, style, link, base')].map((node) => `<${node.nodeName.toLowerCase()}>`);
};

/**
 * Cleans an admin's HTML page for the session's context section. Stored HTML
 * is untrusted, since set-config and MCP can write it directly, so the page
 * cleans it again every time it shows it. The site's CSP is a second layer.
 */
export const cleanContextHtml = (input: string): CleanContextHtml => {
  const purify = getPurifier();
  const source = String(input ?? '');
  const fragment = purify.sanitize(source, { ...CONFIG, RETURN_DOM_FRAGMENT: true });
  const removed = new Set<string>(headExtras(source));
  purify.removed.forEach((entry) => {
    if ('element' in entry && entry.element) {
      const name = entry.element.nodeName.toLowerCase();
      // The parser's own wrappers, not anything the author wrote.
      if (name === '#comment') removed.add('comments');
      else if (!['#text', 'html', 'head', 'body'].includes(name)) removed.add(`<${name}>`);
    } else if ('attribute' in entry && entry.attribute) {
      const name = entry.attribute.name.toLowerCase();
      if (!REPLACED_ATTRIBUTES.has(name)) removed.add(ATTRIBUTE_LABELS[name] || name);
    }
  });
  fragment.querySelectorAll('a').forEach((link) => {
    if (link.hasAttribute('href') && !isHttps(link.getAttribute('href'))) {
      link.removeAttribute('href');
      removed.add('links that aren’t https');
    }
    if (link.hasAttribute('href')) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  });
  fragment.querySelectorAll('img').forEach((image) => {
    if (!isHttps(image.getAttribute('src'))) {
      image.remove();
      removed.add('images that aren’t https');
    }
  });
  const holder = document.createElement('div');
  holder.appendChild(fragment);
  return { html: holder.innerHTML.trim(), removed: [...removed] };
};
