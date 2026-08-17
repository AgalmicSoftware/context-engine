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

  it('centers the session selector under its trigger at medium widths without exceeding the viewport', () => {
    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.headerSessionSelectorPanel\s*{[\s\S]*?right:\s*auto;[\s\S]*?left:\s*50%;[\s\S]*?width:\s*min\(460px,\s*calc\(100vw - 48px\)\);[\s\S]*?transform:\s*translateX\(-50%\);/,
    );
  });

  it('uses UserPage-style neutral depth and scopes status borders to demo mode', () => {
    expect(scss).toMatch(
      /\.explorerCol\s*{[\s\S]*?&\.statusBorderEnabled[\s\S]*?border:\s*4px solid color-mix\(in srgb,\s*var\(--ce-action-accent\) 78%,\s*transparent\);/,
    );
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
});
