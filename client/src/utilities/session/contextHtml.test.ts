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

  it('removes @import however it is nested, in one pass', () => {
    const nested = [
      '<style>@imp@import ;ort url(https://example.org/a.css); p { color: teal; }</style>',
      '<style>@imp@imp@import ;ort ;ort url(https://example.org/a.css); p { color: teal; }</style>',
    ];
    for (const page of nested) {
      const cleaned = cleanContextHtml(page);
      expect(cleaned).toEqual({ html: '<style> p { color: teal; }</style>', removed: ['@import'] });
      expect(cleanContextHtml(cleaned.html)).toEqual({ html: cleaned.html, removed: [] });
    }
  });

  it('drops CSS it cannot read as the browser does, or that tests the site around the page', () => {
    const cases = [
      ['<style>@\\69mport url(https://example.org/a.css); p { color: teal; }</style>', 'escaped @-rules'],
      ['<style>@i\\mport url(https://example.org/a.css);</style>', 'escaped @-rules'],
      [
        '<style>:host-context([data-ce-color-vision^="d"]) p { background: url(https://example.org/d); }</style>',
        ':host-context',
      ],
      [
        '<style>@container style(--ce-status-success: #1a7f37) { p { background: url(https://example.org/s); } }</style>',
        'style queries',
      ],
    ];
    for (const [page, label] of cases) {
      expect(cleanContextHtml(`${page}<p>Hi</p>`)).toEqual({ html: '<style></style><p>Hi</p>', removed: [label] });
    }
    const attribute =
      '<p style="background: if(style(--ce-theme: dark): url(https://example.org/t); else: none)">Hi</p>';
    expect(cleanContextHtml(attribute)).toEqual({ html: '<p style="">Hi</p>', removed: ['style queries'] });
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
