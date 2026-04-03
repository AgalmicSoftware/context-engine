import fs from 'fs';
import path from 'path';

describe('Modals contrast styles', () => {
  it('keeps the white email entry surface on dark text', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/background:\s*var\(--ce-color-white\);\s*color:\s*#1f2733;/);
    expect(scss).not.toMatch(/background:\s*var\(--ce-color-white\);\s*color:\s*#ffffff;/);
  });

  it('keeps the mobile slide layout hooks without overriding the desktop intro framing', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(max-width:\s*768px\)\s*{[\s\S]*?#siteExplainer\[data-slide-layout='flushBottom'\],\s*#siteExplainerMultiply\[data-slide-layout='centered'\]\s*\{\s*overflow:\s*hidden;/);
    expect(scss).toMatch(/@media \(max-width:\s*768px\)\s*{[\s\S]*?#greetingImage\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?object-position:\s*left bottom;/);
    expect(scss).toMatch(/@media \(max-width:\s*768px\)\s*{[\s\S]*?#betaViewerRobot\[data-slide-layout='centered'\]\s*\{[\s\S]*?object-position:\s*center center;/);
    expect(scss).toMatch(/#greetingImage\s*\{[\s\S]*?max-height:\s*60vh;[\s\S]*?max-width:\s*95vw;/);
    expect(scss).toMatch(/#betaViewerRobot\s*\{[\s\S]*?max-height:\s*100%;[\s\S]*?max-width:\s*170%;/);
  });

  it('keeps the desktop right sidebar visible even when its inner content is empty', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?#betaTabSideBar\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*clamp\(280px,\s*31vw,\s*340px\);/);
    expect(scss).toMatch(/@media \(min-width:\s*1367px\)\s*{[\s\S]*?#betaTabSideBar\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*380px;/);
  });
});
