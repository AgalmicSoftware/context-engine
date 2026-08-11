import fs from 'fs';
import path from 'path';

describe('BeeswarmPlot module styles', () => {
  it('keeps hover details compact enough to leave nearby points available', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'BeeswarmPlot.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.hoverTooltip\s*{[\s\S]*?width:\s*min\(320px,\s*calc\(100vw - 24px\)\);[\s\S]*?padding:\s*12px 14px;[\s\S]*?border-radius:\s*var\(--ce-radius-12\);[\s\S]*?pointer-events:\s*none;/,
    );
    expect(scss).toMatch(
      /\.tooltipStat\s*{[\s\S]*?min-height:\s*32px;[\s\S]*?padding:\s*6px 9px;[\s\S]*?font-size:\s*0\.8rem;/,
    );
    expect(scss).toMatch(/\.tooltipResponseBar\s*{[\s\S]*?height:\s*12px;/);
    expect(scss).not.toMatch(/\.hoverTooltip\s*{[\s\S]*?width:\s*min\(520px,/);
  });

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
