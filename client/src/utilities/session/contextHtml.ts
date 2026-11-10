import DOMPurify from 'dompurify';

// What an uploaded context page may keep: text structure, https links and
// images, tables, details/summary sections that open in place, and its own
// CSS in style blocks, style and class attributes. Scripts, event handlers,
// frames, forms and @import go. The page renders in a shadow root inside a
// box that clips it, so its CSS styles only the page.
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
  'style',
];
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'colspan', 'rowspan', 'open', 'style', 'class'];
// FORCE_BODY keeps a style block that opens the page in the page.
const CONFIG = { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, FORCE_BODY: true };
const IMPORT_RULE = /@import\b[^;]*;?/gi;
// CSS this check can't read as the browser does, or that tests the site around
// the page: an @-rule name with escapes reads as the rule it spells (`@\69mport`
// is @import), and :host-context() and style queries match the site's own
// elements and values, so a page could load a URL for each guess. A style block
// that has any of them is dropped whole, and so is a style attribute.
const HIDDEN_CSS = [
  { pattern: /@[\w-]*\\/, label: 'escaped @-rules' },
  { pattern: /:host-context\s*\(/i, label: ':host-context' },
  { pattern: /\bstyle\s*\(/i, label: 'style queries' },
];

// Its own instance, so no other library's hooks or settings reach it.
let purifier: ReturnType<typeof DOMPurify> | null = null;
// Filled by the hooks while one sanitize call runs; sanitizing is synchronous.
const cssRemoved = new Set<string>();
const hiddenIn = (css: string) => HIDDEN_CSS.find(({ pattern }) => pattern.test(css));

// @import would load CSS from elsewhere. Taking one out can join the text around
// it into another, so it repeats until nothing changes.
const cleanStyleBlock = (css: string) => {
  let cleaned = css;
  for (let before = ''; before !== cleaned;) {
    before = cleaned;
    cleaned = cleaned.replace(IMPORT_RULE, '');
  }
  if (cleaned !== css) cssRemoved.add('@import');
  const hidden = hiddenIn(cleaned);
  if (!hidden) return cleaned;
  cssRemoved.add(hidden.label);
  return '';
};

const getPurifier = () => {
  if (!purifier) {
    purifier = DOMPurify(window);
    purifier.addHook('uponSanitizeElement', (node) => {
      if (node.nodeName !== 'STYLE' || !node.textContent) return;
      const cleaned = cleanStyleBlock(node.textContent);
      if (cleaned !== node.textContent) node.textContent = cleaned;
    });
    purifier.addHook('uponSanitizeAttribute', (_node, data) => {
      const hidden = data.attrName === 'style' ? hiddenIn(data.attrValue) : undefined;
      if (!hidden) return;
      cssRemoved.add(hidden.label);
      data.attrValue = '';
    });
  }
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

// A whole page, or a fragment that starts with a style block, has a head the
// parser keeps apart from its body. Its style blocks join the page, and what
// else would have loaded or run is reported. DOMParser runs no scripts, and
// nothing it builds is shown.
const splitHead = (input: string) => {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  const styles = [...doc.head.querySelectorAll('style')].map((node) => node.outerHTML).join('');
  const dropped = [...doc.head.querySelectorAll('script, link, base')].map(
    (node) => `<${node.nodeName.toLowerCase()}>`,
  );
  return { source: styles + doc.body.innerHTML, dropped };
};

/**
 * Cleans an admin's HTML page for the session's context section. Stored HTML
 * is untrusted, since set-config and MCP can write it directly, so the page
 * cleans it again every time it shows it. The site's CSP is a second layer.
 */
export const cleanContextHtml = (input: string): CleanContextHtml => {
  const purify = getPurifier();
  const { source, dropped } = splitHead(String(input ?? ''));
  cssRemoved.clear();
  const fragment = purify.sanitize(source, { ...CONFIG, RETURN_DOM_FRAGMENT: true });
  const removed = new Set<string>([...dropped, ...cssRemoved]);
  purify.removed.forEach((entry) => {
    if ('element' in entry && entry.element) {
      const name = entry.element.nodeName.toLowerCase();
      // The parser's wrappers and DOMPurify's FORCE_BODY marker, not anything the author wrote.
      if (name === '#comment') removed.add('comments');
      else if (!['#text', 'html', 'head', 'body', 'remove'].includes(name)) removed.add(`<${name}>`);
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
