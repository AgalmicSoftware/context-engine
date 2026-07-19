import fs from 'fs';
import path from 'path';

describe('Main welcome walkthrough styles', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'MainContent.module.scss'), 'utf8');
  const onboardingStart = scss.indexOf('/* --- OnboardingWalkthrough --- */');
  const desktopStart = scss.indexOf('@media (min-width: 1367px)', onboardingStart);
  const desktopEnd = scss.indexOf('\n.getStartedButton', desktopStart);
  const desktopScss = scss.slice(desktopStart, desktopEnd);
  const baseStart = scss.indexOf('\n.onboardingWalkthrough {', desktopEnd);
  const baseEnd = scss.indexOf('\n.takeSurveyButton {', baseStart);
  const baseScss = scss.slice(baseStart, baseEnd);

  it('keeps every desktop welcome slide on one responsive frame height', () => {
    expect(desktopScss).toMatch(
      /\.onboardingWalkthrough\s*\{[\s\S]*?--ce-main-welcome-frame-height:\s*max\(540px,\s*30vw\);/,
    );
    expect(baseScss).toMatch(/height:\s*var\(--ce-main-welcome-frame-height,\s*100%\);/);
  });

  it('keeps the desktop control rail flush with the main slide and gives each control half the height', () => {
    expect(desktopScss).toMatch(
      /\.onboardingWalkthrough \.onboardingControls\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?align-self:\s*stretch;[\s\S]*?height:\s*auto;/,
    );
    expect(desktopScss).toMatch(
      /> \.sidebarOpen,\s*> \.openSidebarButton,\s*> \.takeSurveyButton\s*\{[\s\S]*?min-height:\s*0;/,
    );
    expect(desktopScss).toMatch(/\.sidebarOpen\s*\{[\s\S]*?height:\s*auto;/);
    expect(desktopScss).not.toMatch(/\.onboardingWalkthrough \.onboardingControls\s*\{[\s\S]*?height:\s*500px;/);
    expect(baseScss).not.toMatch(/\.onboardingControls\s*\{[\s\S]*?display:\s*flex;/);
  });
});
