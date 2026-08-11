import fs from 'fs';
import path from 'path';

describe('Onboarding overlay welcome slide styles', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'OnboardingOverlay.module.scss'), 'utf8');

  it('moves medium slide arrows below the skip button instead of leaving them in the content flow', () => {
    expect(scss).toMatch(/\.panelFrame\s*\{[\s\S]*?height:\s*min\(92vh,\s*1180px\);[\s\S]*?min-height:\s*680px;/);
    expect(scss).toMatch(/\.panel\s*\{[\s\S]*?--modal-panel-pad-top:\s*24px;[\s\S]*?--modal-panel-pad-bottom:\s*76px;/);
    expect(scss).toMatch(
      /\.onboardingControls\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(-1 \* var\(--modal-panel-pad-top\)\);[\s\S]*?right:\s*calc\(-1 \* var\(--modal-panel-pad-x\)\);[\s\S]*?bottom:\s*calc\(-1 \* var\(--modal-panel-pad-bottom\)\);[\s\S]*?height:\s*auto;/,
    );
    expect(scss).toMatch(
      /\.onboardingControlsSingleArrow\s*\{[\s\S]*?grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(scss).toMatch(/\.controlSlot\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?height:\s*auto;/);
    expect(scss).toMatch(
      /\.controlSlotPlaceholder\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--ce-status-success\) 28%,\s*transparent\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.panel\s*\{[\s\S]*?--modal-panel-pad-bottom:\s*158px;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.onboardingControls\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*auto;[\s\S]*?right:\s*calc\(-1 \* var\(--modal-panel-pad-x\)\);[\s\S]*?bottom:\s*calc\(-1 \* var\(--modal-panel-pad-bottom\)\);[\s\S]*?left:\s*calc\(-1 \* var\(--modal-panel-pad-x\)\);[\s\S]*?transform:\s*none;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.onboardingControls\s*\{[\s\S]*?width:\s*auto;[\s\S]*?height:\s*76px;[\s\S]*?gap:\s*0;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.takeSurveyButton\s*\{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--ce-status-success\) 42%,\s*transparent\);[\s\S]*?color:\s*color-mix\(in srgb,\s*var\(--ce-overlay-base\) 82%,\s*transparent\);/,
    );
    expect(scss).toMatch(/@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.skipButton\s*\{[\s\S]*?bottom:\s*98px;/);
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.controlSlotPlaceholder\s*\{[\s\S]*?display:\s*none;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.panel\s*\{[\s\S]*?--modal-panel-pad-x:\s*10px;[\s\S]*?--modal-panel-pad-bottom:\s*138px;[\s\S]*?padding:\s*16px 10px var\(--modal-panel-pad-bottom\);/,
    );
    expect(scss).toMatch(/@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.skipButton\s*\{[\s\S]*?bottom:\s*82px;/);
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.onboardingControls\s*\{[\s\S]*?bottom:\s*calc\(-1 \* var\(--modal-panel-pad-bottom\)\);[\s\S]*?height:\s*62px;/,
    );
    expect(scss).not.toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.onboardingControls\s*\{[\s\S]*?position:\s*static;/,
    );
  });

  it('keeps minimized slide titles and bullets on the full welcome scale', () => {
    expect(scss).toMatch(
      /\.onboardingTitle\s*\{[\s\S]*?font-weight:\s*800;[\s\S]*?letter-spacing:\s*0;[\s\S]*?font-size:\s*clamp\(4\.75rem,\s*6\.2vw,\s*7\.6rem\);/,
    );
    expect(scss).toMatch(/\.deck\s*\{[\s\S]*?align-items:\s*center;[\s\S]*?flex:\s*1 1 auto;/);
    expect(scss).toMatch(
      /\.bulletList\s*\{[\s\S]*?font-size:\s*clamp\(1\.35rem,\s*1\.9vw,\s*2\.05rem\);[\s\S]*?gap:\s*clamp\(14px,\s*1\.45vh,\s*26px\);/,
    );
    expect(scss).toMatch(/\.bulletText\s*\{[\s\S]*?font-size:\s*1\.32em;[\s\S]*?line-height:\s*1\.14;/);
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.onboardingTitle\s*\{[\s\S]*?font-size:\s*clamp\(3\.4rem,\s*8\.4vw,\s*5\.4rem\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.onboardingTitle\s*\{[\s\S]*?font-size:\s*clamp\(3rem,\s*11vw,\s*4\.6rem\);[\s\S]*?line-height:\s*0\.95;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.bulletList\s*\{[\s\S]*?font-size:\s*clamp\(1\.35rem,\s*5\.4vw,\s*2\.05rem\);[\s\S]*?gap:\s*clamp\(9px,\s*1\.6vh,\s*16px\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.bulletText\s*\{[\s\S]*?font-size:\s*1\.08em;[\s\S]*?line-height:\s*1\.15;/,
    );
  });

  it('gives the first minimized slide a larger artwork slot without changing later slide media sizing', () => {
    expect(scss).toMatch(/\.mediaButton\s*\{[\s\S]*?flex:\s*0 0 clamp\(300px,\s*38%,\s*520px\);/);
    expect(scss).toMatch(
      /\.mediaButton\[data-slide-key='intro'\]\s*\{[\s\S]*?flex-basis:\s*clamp\(520px,\s*62%,\s*780px\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.mediaButton\[data-slide-key='intro'\]\s*\{[\s\S]*?flex-basis:\s*100%;[\s\S]*?min-height:\s*clamp\(300px,\s*56vw,\s*430px\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaButton\[data-slide-key='intro'\]\s*\{[\s\S]*?height:\s*clamp\(260px,\s*76vw,\s*420px\);/,
    );
  });

  it('centers the toolkit artwork instead of clipping it against the left edge', () => {
    expect(scss).toMatch(
      /\.mediaImageToolkit\s*\{[\s\S]*?max-width:\s*116%;[\s\S]*?align-self:\s*center;[\s\S]*?object-position:\s*center center;/,
    );
    expect(scss).not.toMatch(/\.mediaImageToolkit\s*\{[\s\S]*?transform:\s*translateX\(8%\);/);
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaImageToolkit\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?transform:\s*none;/,
    );
  });

  it('uses the transparent goals artwork without reintroducing an inverted image rectangle', () => {
    expect(scss).toMatch(
      /\.mediaImageGoals\s*\{[\s\S]*?mix-blend-mode:\s*var\(--ce-welcome-artwork-blend-cutout\)\s*!important;[\s\S]*?opacity:\s*0\.86;/,
    );
    expect(scss).not.toMatch(/\.mediaImageGoals\s*\{[\s\S]*?filter:\s*invert\(1\);/);
  });

  it('contains tall slide artwork inside the phone media slot', () => {
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaButton\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?height:\s*clamp\(180px,\s*48vw,\s*245px\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.mediaImage\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?object-fit:\s*contain;/,
    );
  });

  it('blends the audience slide jpeg with scss only so its source background falls away', () => {
    expect(scss).toMatch(/\.onboardingWalkthrough\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*auto;/);
    expect(scss).toMatch(
      /\.mediaImageBuiltToHelp\s*\{[\s\S]*?mix-blend-mode:\s*var\(--ce-welcome-artwork-blend-cutout\)\s*!important;[\s\S]*?opacity:\s*1;[\s\S]*?filter:\s*brightness\(1\.08\) saturate\(1\.18\) contrast\(1\.08\);/,
    );
    expect(scss).not.toMatch(/\.mediaImageBuiltToHelp\s*\{[\s\S]*?mask-image:/);
  });

  it('keeps the skip button subdued until hovered', () => {
    expect(scss).toMatch(/\.skipButton\s*\{[\s\S]*?opacity:\s*0\.7;/);
    expect(scss).toMatch(/\.skipButton:hover,\s*\.skipButton:focus\s*\{[\s\S]*?opacity:\s*0\.84;/);
  });
});
