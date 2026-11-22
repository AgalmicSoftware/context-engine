import fs from 'fs';
import path from 'path';

describe('ToolExplorer sparse card layout', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'ToolExplorer.module.scss'), 'utf8');

  it('uses the available full-screen width and viewport height for three-card layouts', () => {
    expect(scss).toMatch(
      /\.explorerContainerSparse\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?padding-left:\s*0;[\s\S]*?padding-right:\s*0;/,
    );
    expect(scss).toMatch(
      /\.explorerRowSparse\s*{[\s\S]*?align-items:\s*center;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?width:\s*100%;/,
    );
    expect(scss).toMatch(
      /\.explorerColSparse\s*{[\s\S]*?height:\s*clamp\(250px,\s*36vh,\s*480px\);[\s\S]*?padding-bottom:\s*0;/,
    );
  });

  it('keeps the compact mobile card-height override', () => {
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)[\s\S]*?\.explorerColSparse \.square[\s\S]*?height:\s*clamp\(124px,\s*19vh,\s*156px\);/,
    );
  });

  it('uses UserPage-style neutral depth', () => {
    expect(scss).toMatch(
      /\.square\s*{[\s\S]*?border-color:\s*var\(--ce-tool-card-border\);[\s\S]*?border-width:\s*var\(--ce-border-control-width\);[\s\S]*?background:\s*var\(--ce-surface-alt\);[\s\S]*?box-shadow:\s*var\(--ce-tool-card-shadow\);/,
    );
    expect(scss).toMatch(
      /&:hover\s*{[\s\S]*?transform:\s*translateY\(-3px\);[\s\S]*?background:\s*var\(--ce-tool-card-hover-bg\);[\s\S]*?box-shadow:\s*var\(--ce-tool-card-shadow-hover\);/,
    );
  });

  it('incorporates the bundled artwork into compact classic Control Panel applets', () => {
    expect(scss).toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(scss).not.toContain('data-ce-theme');
    expect(scss).toMatch(
      /\.backgroundImage\s*{[\s\S]*?display:\s*block;[\s\S]*?position:\s*relative;[\s\S]*?height:\s*124px;[\s\S]*?background-size:\s*cover;/,
    );
    expect(scss).toMatch(/\.classicToolIcon\s*{\s*display:\s*none;/);
    expect(scss).toMatch(
      /\.explorerCol \.square,[\s\S]*?height:\s*248px;[\s\S]*?background:\s*var\(--ce-control-face\);[\s\S]*?box-shadow:\s*var\(--ce-shadow-raised\);/,
    );
    expect(scss).toMatch(
      /\.explorerCol \.square:hover,[\s\S]*?\.explorerColSparse \.square:focus-within\s*{[\s\S]*?background:\s*var\(--ce-control-face\);[\s\S]*?box-shadow:\s*var\(--ce-shadow-raised\);/,
    );
  });

  it('makes the bundled artwork dominant in classic mobile applets', () => {
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.explorerCol \.square,[\s\S]*?\.explorerColSparse \.square\s*{[\s\S]*?height:\s*232px;[\s\S]*?min-height:\s*232px;[\s\S]*?\.backgroundImage\s*{[\s\S]*?flex-basis:\s*128px;[\s\S]*?height:\s*128px;/,
    );
  });

  it("keeps the session box on Back's row by letting it shrink before it wraps", () => {
    const controls = scss.slice(scss.indexOf('\n.expandedHeaderPrimaryControls {'));
    const session = controls.match(/\.expandedHeaderSession\s*{([\s\S]*?)\n {2}}/)?.[1] || '';
    // It takes what the row has left, not its content's width, so a long session name no longer forces a wrap.
    expect(session).toMatch(/flex:\s*1 1 0;/);
    expect(session).not.toMatch(/width:\s*fit-content/);
    // It drops to its own row only when less than a useful width is left.
    expect(session).toMatch(/min-width:\s*min\(100%,\s*200px\);/);
    expect(session).toMatch(/justify-content:\s*flex-end;/);
    expect(session).toMatch(/\.activeSessionControl\s*{\s*min-width:\s*0;/);
    // Questions and Groups use the compact header, which must not put the content-sized box back.
    const compact = scss.slice(
      scss.indexOf('\n.expandedHeaderCompact {'),
      scss.indexOf('\n.expandedHeaderQuestions {'),
    );
    expect(compact).not.toMatch(/\.expandedHeaderSession\s*{/);
  });

  it('puts Add and View on the session row for Context on a wide screen only', () => {
    const wide =
      scss.match(/@media \(min-width: 992px\) {\n {2}\.expandedHeaderContext {([\s\S]*?)\n {2}}\n}/)?.[1] || '';
    expect(wide).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto;/);
    expect(wide).toMatch(/\.expandedHeaderPrimaryControls\s*{\s*grid-column:\s*1;\s*flex-wrap:\s*nowrap;/);
    expect(wide).toMatch(/\.expandedHeaderActions\s*{\s*grid-column:\s*2;\s*flex-wrap:\s*nowrap;/);
    // Nothing else names the Context header, so narrower screens keep Add and View on their own row.
    expect(scss.match(/\.expandedHeaderContext/g)).toHaveLength(1);
  });
});
