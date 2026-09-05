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
    expect(compactDesktopScss).toContain('--ce-main-welcome-frame-height: max(0px, min(600px, calc(100dvh - 400px)));');
    expect(compactDesktopScss).not.toMatch(/min-height:\s*600px;/);
    expect(desktopScss).toContain(
      '--ce-main-welcome-frame-height: max(0px, min(max(380px, 30vw), calc(100dvh - 452px)));',
    );
    expect(baseScss).toMatch(/height:\s*var\(--ce-main-welcome-frame-height,\s*100%\);/);
  });

  it('uses a tall shared frame for the standard full-screen desktop deck', () => {
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: standard-app\)\s*{[\s\S]*?\.onboardingWalkthrough\s*{[\s\S]*?--ce-main-welcome-frame-height:\s*max\(540px,\s*calc\(100dvh - 330px\)\);/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: standard-app\)\s*{[\s\S]*?--ce-welcome-controls-height:\s*clamp\(108px,\s*12dvh,\s*140px\);/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: standard-app\)\s*{[\s\S]*?\.onboardingWalkthrough \.onboardingControls\s*{[\s\S]*?flex:\s*0 0 var\(--ce-welcome-controls-height\);[\s\S]*?height:\s*var\(--ce-welcome-controls-height\);[\s\S]*?min-height:\s*var\(--ce-welcome-controls-height\);/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: standard-app\)\s*{[\s\S]*?\.onboardingControls \.takeSurveyIcon\s*{[\s\S]*?font-size:\s*clamp\(64px,\s*7dvh,\s*80px\);/,
    );
  });

  it('centers welcome slide titles across responsive layout modes', () => {
    expect(baseScss).toMatch(
      /\.onboardingTitleArea\s*\{[\s\S]*?width:\s*100%;[\s\S]*?align-items:\s*center;[\s\S]*?align-self:\s*center;/,
    );
    expect(baseScss).toMatch(/\.onboardingTitle\s*\{[\s\S]*?text-align:\s*center;/);
    expect(compactDesktopScss).toMatch(/\.onboardingTitle\s*\{[\s\S]*?align-self:\s*center;/);
    expect(desktopScss).toMatch(/\.onboardingTitle\s*\{[\s\S]*?align-self:\s*center;/);
    expect(desktopScss).not.toMatch(/\.onboardingTitle\s*\{[\s\S]*?align-self:\s*flex-start;/);
  });

  it('keeps compact desktop controls from growing beyond their allocated strip', () => {
    expect(compactDesktopScss).toMatch(/\.onboardingControls\s*\{[\s\S]*?height:\s*clamp\(60px,\s*10dvh,\s*100px\);/);
    expect(compactDesktopScss).toMatch(/\.takeSurveyButton\s*\{[\s\S]*?height:\s*100%;[\s\S]*?flex-direction:\s*row;/);
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

  it('renders the classic home surface as a centered desktop window', () => {
    expect(scss).toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(scss).not.toContain('data-ce-theme');
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.mainTabsCard\s*{[\s\S]*?overflow:\s*visible;[\s\S]*?border:\s*3px solid;[\s\S]*?background:\s*var\(--ce-surface-raised\);[\s\S]*?box-shadow:\s*2px 2px 0 var\(--ce-edge-dark\);/,
    );
    expect(scss).toMatch(/\.mainTabsCardHeader\s*{[\s\S]*?background:\s*var\(--ce-titlebar-bg\);/);
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.mainAreaTabsAlt,[\s\S]*?#mainAreaTabs\s*{[\s\S]*?margin:\s*clamp\(12px,\s*2\.5vh,\s*24px\) auto 16px;/,
    );
  });

  it('keeps welcome arrows on one fixed window frame across themes', () => {
    expect(scss).toContain('@container ce-theme style(--ce-welcome-slide-mode: fixed-window)');
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-welcome-slide-mode: fixed-window\)\s*{[\s\S]*?--ce-welcome-frame-height:\s*var\([\s\S]*?--ce-main-welcome-frame-height,[\s\S]*?clamp\(525px,\s*118vw,\s*600px\)[\s\S]*?height:\s*var\(--ce-welcome-frame-height\);[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-welcome-slide-mode: fixed-window\)\s*{[\s\S]*?\.onboardingControls\s*{[\s\S]*?flex:\s*0 0 var\(--ce-welcome-controls-height\);[\s\S]*?height:\s*var\(--ce-welcome-controls-height\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*768px\)\s*{\s*@container ce-theme style\(--ce-welcome-slide-mode: fixed-window\)\s*{[\s\S]*?\.mainAreaTabsAlt,[\s\S]*?#mainAreaTabs\s*{\s*flex-basis:\s*auto;/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?--ce-welcome-frame-height:\s*min\([\s\S]*?500px,[\s\S]*?var\(--ce-main-welcome-frame-height,\s*clamp\(410px,\s*52dvh,\s*500px\)\)[\s\S]*?\);/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.onboardingTitle\s*{[\s\S]*?max-width:\s*100%;[\s\S]*?font-size:\s*clamp\(1\.5rem,\s*4vw,\s*2rem\);[\s\S]*?overflow-wrap:\s*anywhere;/,
    );
    expect(scss).not.toContain('@container ce-theme style(--ce-welcome-slide-mode: fluid)');
  });

  it('renders both classic welcome arrow icons at full-opacity white', () => {
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.onboardingControls \.takeSurveyIcon\s*{[\s\S]*?color:\s*var\(--ce-text-inverse\);[\s\S]*?opacity:\s*1;/,
    );
  });

  it('renders the classic final welcome action as a readable native control', () => {
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.onboardingControls > \.getStartedButton\s*{[\s\S]*?background:\s*var\(--ce-control-face\);[\s\S]*?border-color:\s*var\(--ce-border-raised\);[\s\S]*?color:\s*var\(--ce-control-text\);[\s\S]*?filter:\s*none !important;/,
    );
  });

  it('spreads the classic home tabs evenly across the title bar', () => {
    expect(scss).toMatch(
      /\.mainTabsCardHeader :global\(\.nav-tabs\)\s*{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(scss).toMatch(
      /\.mainTabsCardHeader :global\(\.nav-item\)\s*{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*100%;/,
    );
    expect(scss).toMatch(
      /\.mainTabsCardHeader :global\(\.nav-link\.active\)\s*{[\s\S]*?justify-content:\s*center;[\s\S]*?font-family:\s*var\(--ce-font-ui\);[\s\S]*?font-size:\s*clamp\(0\.75rem,\s*2\.8vw,\s*1rem\);/,
    );
    expect(scss).toMatch(
      /\.mainTabsCardHeader :global\(\.nav-link\.active > div\)\s*{[\s\S]*?max-width:\s*100%;[\s\S]*?font-size:\s*inherit\s*!important;[\s\S]*?white-space:\s*nowrap;/,
    );
    expect(scss).not.toMatch(/\.nav-item:has\(\.nav-link\.active\)[\s\S]*?order:\s*-1;/);
  });

  it('renders classic inactive tab icons without button borders', () => {
    expect(scss).toMatch(
      /\.mainTabsCardHeader :global\(\.nav-link:not\(\.active\)\)\s*{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    );
    expect(scss).toMatch(
      /\.mainTabsCardHeader :global\(\.nav-link\) \.navTabIcon\s*{[\s\S]*?width:\s*clamp\(1\.25rem,\s*2\.4vw,\s*1\.5rem\);[\s\S]*?height:\s*clamp\(1\.25rem,\s*2\.4vw,\s*1\.5rem\);[\s\S]*?margin-right:\s*0\s*!important;/,
    );
  });
});
