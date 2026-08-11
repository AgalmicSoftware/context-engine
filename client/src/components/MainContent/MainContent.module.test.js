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

  it('keeps compact desktop controls from growing beyond their allocated strip', () => {
    expect(compactDesktopScss).toMatch(
      /\.onboardingControls\s*\{[\s\S]*?height:\s*clamp\(60px,\s*10dvh,\s*100px\);/,
    );
    expect(compactDesktopScss).toMatch(
      /\.takeSurveyButton\s*\{[\s\S]*?height:\s*100%;[\s\S]*?flex-direction:\s*row;/,
    );
    expect(compactDesktopScss).not.toMatch(/\.takeSurveyButton\s*\{[\s\S]*?height:\s*100px;/);
  });

  it('keeps wide desktop controls in a compact bottom strip instead of a side rail', () => {
    expect(desktopScss).toMatch(/\.onboardingWalkthrough\s*\{[\s\S]*?flex-direction:\s*column;/);
    expect(desktopScss).toMatch(
      /\.onboardingWalkthrough \.onboardingControls\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);[\s\S]*?width:\s*100%;[\s\S]*?height:\s*clamp\(56px,\s*8dvh,\s*72px\);/,
    );
    expect(desktopScss).toMatch(
      /> \.sidebarOpen,\s*> \.openSidebarButton,\s*> \.takeSurveyButton\s*\{[\s\S]*?min-height:\s*0;/,
    );
    expect(desktopScss).toMatch(/\.sidebarOpen\s*\{[\s\S]*?height:\s*100%;/);
    expect(desktopScss).not.toMatch(/\.onboardingWalkthrough \.onboardingControls\s*\{[\s\S]*?height:\s*500px;/);
    expect(desktopScss).not.toMatch(/grid-template-rows:\s*repeat\(2/);
    expect(desktopScss).not.toMatch(/width:\s*30%;/);
    expect(baseScss).not.toMatch(/\.onboardingControls\s*\{[\s\S]*?display:\s*flex;/);
  });
});
