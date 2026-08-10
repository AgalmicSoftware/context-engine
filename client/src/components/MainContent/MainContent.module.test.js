import fs from 'fs';
import path from 'path';

describe('Main welcome walkthrough styles', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'MainContent.module.scss'), 'utf8');
  const onboardingStart = scss.indexOf('/* --- OnboardingWalkthrough --- */');
  const compactDesktopStart = scss.indexOf('@media (min-width: 769px) and (max-width: 1366px)', onboardingStart);
  const desktopStart = scss.indexOf('@media (min-width: 1367px)', onboardingStart);
  const compactDesktopScss = scss.slice(compactDesktopStart, desktopStart);
  const desktopEnd = scss.indexOf('\n.getStartedButton', desktopStart);
  const desktopScss = scss.slice(desktopStart, desktopEnd);
  const baseStart = scss.indexOf('\n.onboardingWalkthrough {', desktopEnd);
  const baseEnd = scss.indexOf('\n.takeSurveyButton {', baseStart);
  const baseScss = scss.slice(baseStart, baseEnd);

  it('keeps every desktop welcome slide on one viewport-capped responsive frame height', () => {
    expect(compactDesktopScss).toContain(
      '--ce-main-welcome-frame-height: max(0px, min(600px, calc(100dvh - 400px)));',
    );
    expect(compactDesktopScss).not.toMatch(/min-height:\s*600px;/);
    expect(desktopScss).toContain(
      '--ce-main-welcome-frame-height: max(0px, min(max(380px, 30vw), calc(100dvh - 452px)));',
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
