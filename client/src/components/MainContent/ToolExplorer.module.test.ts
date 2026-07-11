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

  it('uses UserPage-style neutral depth and scopes status borders to demo mode', () => {
    expect(scss).toMatch(
      /\.explorerCol\s*{[\s\S]*?&\.statusBorderEnabled[\s\S]*?border:\s*4px solid rgba\(77,\s*255,\s*164,\s*0\.78\);/,
    );
    expect(scss).toMatch(
      /\.square\s*{[\s\S]*?border:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.14\);[\s\S]*?background:\s*#24264d;[\s\S]*?box-shadow:[\s\S]*?#171a3d[\s\S]*?rgba\(59,\s*63,\s*126,\s*0\.72\)/,
    );
    expect(scss).toMatch(/&:hover\s*{[\s\S]*?transform:\s*translateY\(-3px\);/);
  });
});
