import fs from 'fs';
import path from 'path';

describe('Modals contrast styles', () => {
  it('keeps the white email entry surface on dark text', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/background:\s*var\(--ce-color-white\);\s*color:\s*#1f2733;/);
    expect(scss).not.toMatch(/background:\s*var\(--ce-color-white\);\s*color:\s*#ffffff;/);
  });

  it('keeps the intro image bottom-flush while preserving the centered titleless slide hooks', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/#siteExplainer\[data-slide-layout='flushBottom'\]\s*\{\s*overflow:\s*hidden;[\s\S]*?align-items:\s*flex-end;/);
    expect(scss).toMatch(/#betaInfoEmbed #explainerAndUpdates #siteExplainer\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?align-items:\s*flex-end;/);
    expect(scss).toMatch(/#greetingImage\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?object-fit:\s*contain;[\s\S]*?object-position:\s*left bottom;[\s\S]*?transform:\s*translateY\(2\.75%\);/);
    expect(scss).toMatch(/@media \(min-width:\s*1367px\)\s*{[\s\S]*?#greetingImage\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?width:\s*75%;[\s\S]*?height:\s*100%;/);
    expect(scss).toMatch(/@media \(max-width:\s*768px\)\s*{[\s\S]*?#siteExplainer\[data-slide-layout='flushBottom'\],\s*#siteExplainerMultiply\[data-slide-layout='centered'\]\s*\{\s*overflow:\s*hidden;/);
    expect(scss).toMatch(/@media \(max-width:\s*768px\)\s*{[\s\S]*?#betaViewerRobot\[data-slide-layout='centered'\]\s*\{[\s\S]*?object-position:\s*center center;/);
    expect(scss).toMatch(/#greetingImage\s*\{[\s\S]*?max-width:\s*95vw;/);
    expect(scss).toMatch(/#betaViewerRobot\s*\{[\s\S]*?max-height:\s*100%;[\s\S]*?max-width:\s*170%;/);
  });

  it('keeps the desktop right sidebar visible even when its inner content is empty', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?#betaTabSideBar\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*clamp\(280px,\s*31vw,\s*340px\);/);
    expect(scss).toMatch(/@media \(min-width:\s*1367px\)\s*{[\s\S]*?#betaTabSideBar\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*380px;/);
  });
});
