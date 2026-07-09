import fs from 'fs';
import path from 'path';

describe('BeeswarmPlot module styles', () => {
  it('keeps the mobile beeswarm visible while allowing horizontal overflow as a fallback', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'BeeswarmPlot.module.scss'), 'utf8');

    expect(scss).toMatch(/\.wrapper\s*{[\s\S]*?min-width:\s*0;[\s\S]*?}/);
    expect(scss).toMatch(
      /\.svgShell\s*{[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*visible;[\s\S]*?-webkit-overflow-scrolling:\s*touch;[\s\S]*?}/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.beeswarmSvg\s*{[\s\S]*?min-width:\s*320px;[\s\S]*?}/,
    );
    expect(scss).not.toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.beeswarmSvg\s*{[\s\S]*?min-width:\s*360px;[\s\S]*?}/,
    );
  });
});
