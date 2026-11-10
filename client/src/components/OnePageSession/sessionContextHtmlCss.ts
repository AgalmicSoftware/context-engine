// An uploaded page's defaults, inside its shadow root. They use the colours the
// host passes in (SessionContextHtml.module.scss), so they follow the session's
// scheme and the site's theme. The page's own CSS comes after them and can
// override any of them, with the same colours available as variables.
export const CONTEXT_HTML_PAGE_CSS = `
:host { display: block; color: var(--ce-context-muted); font-size: 0.95rem; line-height: 1.55; overflow-wrap: anywhere; text-align: left; }
:host > :first-child { margin-top: 0; }
h1, h2, h3, h4, h5, h6 { margin: 1rem 0 0.45rem; color: var(--ce-context-text); font-weight: 800; line-height: 1.3; }
h1 { font-size: 1.35rem; }
h2 { font-size: 1.2rem; }
h3 { font-size: 1.05rem; }
h4, h5, h6 { font-size: 0.95rem; }
p, ul, ol, dl, blockquote, pre, figure, table { margin: 0.55rem 0 0; }
ul, ol { padding-left: 1.4rem; }
a[href] { color: var(--ce-context-link); font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
a[href]:focus-visible, summary:focus-visible { outline: 2px solid var(--ce-context-focus); outline-offset: 2px; }
img { max-width: 100%; height: auto; }
blockquote { padding-left: 0.85rem; border-left: 3px solid var(--ce-context-border); }
pre { overflow-x: auto; }
table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
th, td { padding: 0.35rem 0.55rem; border: 1px solid var(--ce-context-border); text-align: left; vertical-align: top; }
details { margin: 0.55rem 0 0; padding: 0.45rem 0.75rem; border: 1px solid var(--ce-context-border); border-radius: 8px; }
summary { color: var(--ce-context-text); font-weight: 700; cursor: pointer; }
details[open] > summary { margin-bottom: 0.35rem; }
`;
