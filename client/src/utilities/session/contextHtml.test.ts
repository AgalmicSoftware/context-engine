import { cleanContextHtml } from './contextHtml';

describe('cleanContextHtml', () => {
  it('keeps structure, https links and images, tables and sections that open in place', () => {
    const html =
      '<h2>Areas</h2><details open><summary>Trust</summary><p>Who <em>decides</em>?</p></details>' +
      '<table><tr><th>Topic</th><td colspan="2">One</td></tr></table>' +
      '<a href="https://example.org/essay">Essay</a><img src="https://example.org/map.png" alt="Map">';
    const cleaned = cleanContextHtml(html);
    expect(cleaned.removed).toEqual([]);
    expect(cleaned.html).toContain('<details open=""><summary>Trust</summary><p>Who <em>decides</em>?</p></details>');
    expect(cleaned.html).toContain('<td colspan="2">One</td>');
    expect(cleaned.html).toContain(
      '<a href="https://example.org/essay" target="_blank" rel="noopener noreferrer">Essay</a>',
    );
    expect(cleaned.html).toContain('<img src="https://example.org/map.png" alt="Map">');
  });

  it("keeps the page's own CSS: style blocks, style and class attributes", () => {
    const html =
      '<style>.card { border: 2px solid var(--ce-context-border); }</style><p class="card" style="color: teal">Hi</p>';
    expect(cleanContextHtml(html)).toEqual({ html, removed: [] });
  });

  it('removes scripts, handlers, frames, forms and @import, and says what went', () => {
    const hostile =
      '<script>steal()</script><p onclick="steal()" style="position:fixed" class="x" id="root">Hi</p>' +
      '<iframe src="https://example.org"></iframe><form action="https://example.org"><input name="q"></form>' +
      '<style>@import url("https://example.org/track.css"); p { color: teal; }</style><svg><script>steal()</script></svg>' +
      '<a href="javascript:steal()">Bad</a><a href="http://example.org">Plain</a><img src="data:image/png;base64,AAAA">';
    const cleaned = cleanContextHtml(hostile);
    expect(cleaned.html).toBe(
      '<p style="position:fixed" class="x">Hi</p><style> p { color: teal; }</style><a>Bad</a><a>Plain</a>',
    );
    expect(cleaned.removed).toEqual(
      expect.arrayContaining([
        '<script>',
        'onclick',
        'id',
        '<iframe>',
        '<form>',
        '<input>',
        '@import',
        '<svg>',
        'links that aren’t https',
        'images that aren’t https',
      ]),
    );
    expect(cleaned.removed).not.toEqual(expect.arrayContaining(['style']));
    expect(cleaned.removed).not.toEqual(expect.arrayContaining(['class']));
  });

  it("keeps a whole document's style blocks and reports what else its head would have loaded or run", () => {
    const page =
      '<!doctype html><html><head><title>Atlas</title><style>h2 { color: teal; }</style>' +
      '<link rel="stylesheet" href="https://example.org/site.css"><script>steal()</script></head>' +
      '<body><h2>Atlas</h2></body></html>';
    const cleaned = cleanContextHtml(page);
    expect(cleaned.html).toBe('<style>h2 { color: teal; }</style><h2>Atlas</h2>');
    expect(cleaned.removed).toEqual(['<link>', '<script>']);
  });

  it('gives the same result when cleaned again, so stored pages render as previewed', () => {
    const once = cleanContextHtml(
      '<style>@import "x.css"; p { color: teal; }</style><p style="color:red">Text <a href="https://example.org">link</a></p>',
    ).html;
    expect(cleanContextHtml(once)).toEqual({ html: once, removed: [] });
  });
});
