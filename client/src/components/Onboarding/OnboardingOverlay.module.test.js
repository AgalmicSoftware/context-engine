import fs from 'fs';
import path from 'path';

describe('Onboarding overlay welcome slide styles', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'OnboardingOverlay.module.scss'), 'utf8');

  it('keeps the modal arrow controls as a top-to-bottom rail until phone layouts', () => {
    expect(scss).toMatch(/\.panelFrame\s*\{[\s\S]*?height:\s*min\(92vh,\s*1180px\);[\s\S]*?min-height:\s*680px;/);
    expect(scss).toMatch(/\.panel\s*\{[\s\S]*?--modal-panel-pad-top:\s*24px;[\s\S]*?--modal-panel-pad-bottom:\s*76px;/);
    expect(scss).toMatch(/\.onboardingControls\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(-1 \* var\(--modal-panel-pad-top\)\);[\s\S]*?right:\s*calc\(-1 \* var\(--modal-panel-pad-x\)\);[\s\S]*?bottom:\s*calc\(-1 \* var\(--modal-panel-pad-bottom\)\);[\s\S]*?height:\s*auto;/);
    expect(scss).toMatch(/\.onboardingControlsSingleArrow\s*\{[\s\S]*?grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    expect(scss).toMatch(/\.controlSlot\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?height:\s*auto;/);
    expect(scss).toMatch(/\.controlSlotPlaceholder\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?background:\s*rgba\(139,\s*183,\s*150,\s*0\.28\);/);
    expect(scss).toMatch(/@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.onboardingControls\s*\{[\s\S]*?position:\s*static;/);
    expect(scss).toMatch(/@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.controlSlotPlaceholder\s*\{[\s\S]*?display:\s*none;/);
    expect(scss).not.toMatch(/@media \(max-width:\s*900px\)\s*\{[\s\S]*?\.onboardingControls\s*\{[\s\S]*?position:\s*static;/);
  });

  it('keeps minimized slide titles and bullets on the full welcome scale', () => {
    expect(scss).toMatch(/\.onboardingTitle\s*\{[\s\S]*?font-weight:\s*800;[\s\S]*?letter-spacing:\s*0;[\s\S]*?font-size:\s*clamp\(4\.25rem,\s*5\.4vw,\s*6\.8rem\);/);
    expect(scss).toMatch(/\.deck\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?flex:\s*1 1 auto;/);
    expect(scss).toMatch(/\.bulletList\s*\{[\s\S]*?font-size:\s*clamp\(1\.15rem,\s*1\.45vw,\s*1\.6rem\);[\s\S]*?gap:\s*clamp\(12px,\s*1\.25vh,\s*22px\);/);
    expect(scss).toMatch(/\.bulletText\s*\{[\s\S]*?font-size:\s*1\.25em;[\s\S]*?line-height:\s*1\.12;/);
  });

  it('gives the first minimized slide a larger artwork slot without changing later slide media sizing', () => {
    expect(scss).toMatch(/\.mediaButton\s*\{[\s\S]*?flex:\s*0 0 clamp\(300px,\s*38%,\s*520px\);/);
    expect(scss).toMatch(/\.mediaButton\[data-slide-key='intro'\]\s*\{[\s\S]*?flex-basis:\s*clamp\(520px,\s*62%,\s*780px\);/);
    expect(scss).toMatch(/@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.mediaButton\[data-slide-key='intro'\]\s*\{[\s\S]*?flex-basis:\s*100%;[\s\S]*?min-height:\s*clamp\(300px,\s*56vw,\s*430px\);/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaButton\[data-slide-key='intro'\]\s*\{[\s\S]*?height:\s*clamp\(260px,\s*76vw,\s*420px\);/);
  });

  it('centers the toolkit artwork instead of clipping it against the left edge', () => {
    expect(scss).toMatch(/\.mediaImageToolkit\s*\{[\s\S]*?max-width:\s*116%;[\s\S]*?align-self:\s*center;[\s\S]*?object-position:\s*center center;/);
    expect(scss).not.toMatch(/\.mediaImageToolkit\s*\{[\s\S]*?transform:\s*translateX\(8%\);/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaImageToolkit\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?transform:\s*none;/);
  });

  it('uses the transparent goals artwork without reintroducing an inverted image rectangle', () => {
    expect(scss).toMatch(/\.mediaImageGoals\s*\{[\s\S]*?mix-blend-mode:\s*screen\s*!important;[\s\S]*?opacity:\s*0\.86;/);
    expect(scss).not.toMatch(/\.mediaImageGoals\s*\{[\s\S]*?filter:\s*invert\(1\);/);
  });

  it('contains tall slide artwork inside the phone media slot', () => {
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaButton\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?height:\s*clamp\(180px,\s*48vw,\s*245px\);/);
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaImage\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*contain;/);
  });

  it('blends the audience slide jpeg with scss only so its source background falls away', () => {
    expect(scss).toMatch(/\.onboardingWalkthrough\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*auto;/);
    expect(scss).toMatch(/\.mediaImageBuiltToHelp\s*\{[\s\S]*?mix-blend-mode:\s*screen\s*!important;[\s\S]*?opacity:\s*1;[\s\S]*?filter:\s*brightness\(1\.08\) saturate\(1\.18\) contrast\(1\.08\);/);
    expect(scss).not.toMatch(/\.mediaImageBuiltToHelp\s*\{[\s\S]*?mask-image:/);
  });

  it('keeps the skip button subdued until hovered', () => {
    expect(scss).toMatch(/\.skipButton\s*\{[\s\S]*?opacity:\s*0\.7;/);
    expect(scss).toMatch(/\.skipButton:hover,\s*\.skipButton:focus\s*\{[\s\S]*?opacity:\s*0\.84;/);
  });
});
