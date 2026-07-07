import fs from 'fs';
import path from 'path';
import { normalizeScssContract } from 'testUtils/scssContractAssertions';

const readSurveyToolScss = () => (
  fs.readFileSync(path.join(__dirname, 'SurveyTool.module.scss'), 'utf8')
);

const readFinalSubmitCtaScss = () => (
  fs.readFileSync(path.join(__dirname, '../../scss/_finalSubmitCta.scss'), 'utf8')
);

describe('SurveyTool styles', () => {
  it('keeps existing-response light-panel CTAs on dark text for readability', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#startFreshButton\s*{[^}]*color:\s*#1f2733;/);
    expect(scss).toMatch(/#exitEditingButton\s*{[^}]*color:\s*#1f2733;/);
    expect(scss).toMatch(/#exitEditingButton[\s\S]*?&:disabled\s*{[^}]*color:\s*rgba\(31,\s*39,\s*51,\s*0\.5\);/);
    expect(scss).not.toMatch(/#startFreshButton\s*{[^}]*color:\s*var\(--ce-color-white\);/);
    expect(scss).not.toMatch(/#exitEditingButton\s*{[^}]*color:\s*var\(--ce-color-white\);/);
  });

  it('removes the old SurveyTool session selector overlay styles', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#surveysRow\s*{[\s\S]*z-index:\s*20;/);
    expect(scss).not.toMatch(/\.sessionSelectorTriggerRow\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorBackdrop\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorPopover\s*{/);
    expect(scss).not.toMatch(/\.surveySelectorRowSessionSelectorOpen\s*{/);
  });

  it('keeps the locked-question decrypt CTA readable on the light banner', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/%decryptCtaOutlineOnLight\s*{[\s\S]*?color:\s*#1f2733\s*!important;/);
    expect(scss).toMatch(/%decryptCtaOutlineOnLight\s*{[\s\S]*?&:hover:not\(:disabled\),[\s\S]*?color:\s*#111722\s*!important;/);
    expect(scss).toMatch(/%decryptCtaOutlineOnLight\s*{[\s\S]*?&:disabled\s*{[\s\S]*?color:\s*rgba\(31,\s*39,\s*51,\s*0\.52\)\s*!important;/);
    expect(scss).toMatch(/\.lockedQuestionsDecryptButton\s*{\s*@extend\s+%decryptCtaOutlineOnLight;/);
    expect(scss).not.toMatch(/\.lockedQuestionsDecryptButton\s*{\s*@extend\s+%decryptCtaOutline;/);
  });

  it('keeps the questions selector encrypted badge aligned with the title copy', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.questionSelectorSummary\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
    expect(scss).toMatch(/\.questionSelectorEncryptedBadge\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
    expect(scss).toMatch(/\.questionSelectorSpinner\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
  });

  it('keeps the additional-comments lock inline with the input field', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.additionalCommentsInlineRow\s*{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*flex-start;[\s\S]*?width:\s*100%;/);
    expect(scss).toMatch(/\.additionalCommentsInputWrap\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;/);
    expect(scss).toMatch(/\.additionalCommentsLockSlot\s*{[\s\S]*?display:\s*flex;[\s\S]*?padding-top:\s*10px;/);
  });

  it('keeps the pile lock popover readable without inheriting the footer icon opacity', () => {
    const scss = readSurveyToolScss();
    const pileCardIconsBlock = scss.match(/\.pileCardIcons\s*{[^}]*}/)?.[0] || '';

    expect(pileCardIconsBlock).not.toMatch(/opacity\s*:/);
    expect(scss).toMatch(/\.pileLockButtonMenuOpen\s*{[\s\S]*?background:\s*rgba\(5,\s*10,\s*24,\s*0\.78\);/);
    expect(scss).toMatch(/\.pileLockAudiencePopover\s*{[\s\S]*?background:\s*rgba\(11,\s*15,\s*28,\s*0\.8\);/);
    expect(scss).toMatch(/\.pileLockAudiencePopover\s*{[\s\S]*?opacity:\s*0\.8;/);
  });

  it('keeps the single-question submit button stacked below the card', () => {
    const scss = readSurveyToolScss();
    const sharedCta = readFinalSubmitCtaScss();

    expect(scss).toMatch(/#surveyFooter\.singleQuestionSubmitFooter\s*{[\s\S]*?position:\s*static;[\s\S]*?align-self:\s*center;[\s\S]*?width:\s*min\(360px,\s*100%\);[\s\S]*?margin:\s*18px auto 0;[\s\S]*?display:\s*flex;/);
    expect(sharedCta).toMatch(/@mixin final-submit-cta-shell\s*\([\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?background-color:\s*#2a63ca !important;[\s\S]*?border:\s*1px solid #2a63ca !important;[\s\S]*?background-color:\s*var\(--ce-color-indigo\) !important;[\s\S]*?transform:\s*translateY\(-2px\);[\s\S]*?&:disabled\s*{[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.78\) !important;/);
    expect(sharedCta).toMatch(/@mixin final-submit-cta-content\(\$gap: 12px\)\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?width:\s*100%;[\s\S]*?text-transform:\s*uppercase;/);
    expect(scss).toMatch(/#submitSurveyButton\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-shell\(/);
    expect(scss).toMatch(/#submitSurveyButton\.singleQuestionSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*72px;[\s\S]*?font-size:\s*1\.4rem;[\s\S]*?border-radius:\s*var\(--ce-radius-12\);/);
    expect(scss).toMatch(/\.singleQuestionSubmitButtonContent\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-content\(\$gap:\s*14px\);[\s\S]*?text-transform:\s*uppercase;/);
    expect(scss).toMatch(/\.singleQuestionSubmitButtonIcon\s*{[\s\S]*?font-size:\s*1\.5em;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?#surveyFooter\.singleQuestionSubmitFooter\s*{[\s\S]*?width:\s*100%;[\s\S]*?flex-direction:\s*column;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?#submitSurveyButton\.singleQuestionSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?opacity:\s*1;/);
  });

  it('keeps pile submit controls responsive across desktop, medium-desktop, medium, and small breakpoints', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.pileWrapper\s*{[\s\S]*?margin-bottom:\s*38px;/);
    expect(scss).toMatch(/\.pileSubmitButton\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-shell\(/);
    expect(scss).toMatch(/\.pileSubmitButtonContent\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-content\(\$gap:\s*12px\);[\s\S]*?text-transform:\s*uppercase;/);
    expect(scss).toMatch(/\.pileInteractionUnit\s*{[\s\S]*?--pile-desktop-submit-rail-offset:\s*42px;[\s\S]*?--pile-desktop-rail-gap:\s*24px;[\s\S]*?--pile-card-width:\s*min\(550px,\s*90vw\);[\s\S]*?display:\s*flex;[\s\S]*?position:\s*relative;[\s\S]*?width:\s*var\(--pile-card-width\);[\s\S]*?max-width:\s*90vw;/);
    expect(scss).toMatch(/\.pileCardContainer\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?position:\s*relative;/);
    expect(scss).not.toMatch(/\.pileInteractionUnitWithSubmitRail\s*{/);
    expect(scss).toMatch(/\.pileControls\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*0;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?left:\s*0;[\s\S]*?width:\s*100%;/);
    expect(scss).not.toMatch(/grid-template-areas:\s*[\s\S]*?'nav submit'[\s\S]*?'actions submit'/);
    expect(scss).toMatch(/\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*calc\(100% \+ var\(--pile-desktop-rail-gap\)\);/);
    expect(scss).toMatch(/\.pileControls > \.pileActions\s*{[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(0\.625rem\);/);
    expect(scss).toMatch(/\.pileControls > \.pileNav\s*{[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(calc\(-100% - 0\.625rem\)\);/);
    expect(scss).toMatch(/\.pileFooter\s*{[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*min\(550px,\s*90vw\);[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(-1 \* var\(--pile-desktop-submit-rail-offset\)\);[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translateX\(-50%\);/);
    expect(scss).toMatch(/\.pileFooterHidden\s*{[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden;[\s\S]*?pointer-events:\s*none;/);
    expect(scss).toMatch(/\.pileFooter\s+\.pileSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*60px;[\s\S]*?font-size:\s*1\.15rem;/);
    expect(scss).toMatch(/\.pileSubmitSuccessBadge\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?width:\s*60px;[\s\S]*?height:\s*60px;[\s\S]*?border-radius:\s*50%;/);
    expect(scss).toMatch(/\.pileSubmitButtonTrail\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(/\.actionButton\.pileActionMenuToggle\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(/\.pileActionButtonGroup\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
    expect(scss).toMatch(/\.miniSpinnerWrapper\s*{[\s\S]*?top:\s*-30px;[\s\S]*?right:\s*-75px;/);
    expect(scss).toMatch(/\.pileHologramToggle\s*{[\s\S]*?top:\s*6px;[\s\S]*?right:\s*16px;/);
    expect(scss).toMatch(/@media \(min-width: 1367px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?top:\s*-50px;[\s\S]*?right:\s*32px;[\s\S]*?left:\s*0;[\s\S]*?width:\s*auto;[\s\S]*?transform:\s*none;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileWrapper\s*{[\s\S]*?margin-bottom:\s*0;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileInteractionUnit\s*{[\s\S]*?width:\s*var\(--pile-card-width\);[\s\S]*?max-width:\s*90vw;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;[\s\S]*?justify-content:\s*center;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?align-items:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?margin-top:\s*35px;[\s\S]*?gap:\s*20px;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActions\s*{[\s\S]*?order:\s*1;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionButtonGroup\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?gap:\s*16px;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionsMenuEligible\s*{[\s\S]*?position:\s*relative;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?overflow:\s*visible;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionsMenuEligible \.pileActionMenuToggle\s*{[\s\S]*?display:\s*flex;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;[\s\S]*?box-shadow:\s*none;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionsMenuEligible \.pileActionButtonGroup\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(100% \+ 10px\);[\s\S]*?display:\s*none;[\s\S]*?flex-direction:\s*column;/);
    expect(scss).toMatch(/\.pileActionsMenuEligible:focus-within \.pileActionButtonGroup,\s*[\s\S]*?\.pileActionsMenuEligible:hover \.pileActionButtonGroup\s*{[\s\S]*?display:\s*flex;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?order:\s*2;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*none;[\s\S]*?margin-right:\s*8px;[\s\S]*?gap:\s*12px;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileNav\s*{[\s\S]*?order:\s*3;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?min-width:\s*0;[\s\S]*?font-size:\s*1rem;/);
    expect(scss).not.toContain('gap: 18px 12px;');
    expect(scss).not.toContain('top: -52px;');
    expect(scss).not.toContain('min-height: 54px;');
    expect(scss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?gap:\s*10px;[\s\S]*?padding:\s*0 6px;/);
    expect(scss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?flex:\s*1 1 190px;[\s\S]*?gap:\s*8px;[\s\S]*?margin-right:\s*0;/);
    expect(scss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.pileNav\s*{[\s\S]*?gap:\s*8px;[\s\S]*?padding:\s*6px 4px;/);
    expect(scss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?min-width:\s*150px;[\s\S]*?min-height:\s*0;[\s\S]*?padding:\s*12px 18px;[\s\S]*?font-size:\s*1rem;[\s\S]*?border-radius:\s*var\(--ce-radius-8\);/);
    expect(scss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.pileSubmitSuccessBadge\s*{[\s\S]*?width:\s*54px;[\s\S]*?height:\s*54px;/);
    expect(scss).toMatch(/@media \(min-width: 769px\)\s*{[\s\S]*?\.pileSubmitButtonTrail\s*{[\s\S]*?display:\s*inline-flex;/);
    expect(scss).not.toMatch(/@media \(min-width: 769px\), \(max-width: 480px\)/);
  });

  it('ports the recovered animLine border motion onto pile submit rails at every size', () => {
    const scss = readSurveyToolScss();
    const normalizedScss = normalizeScssContract(scss);

    expect(normalizedScss).toMatch(/\.pileFooter\s+\.pileSubmitButton\.submitGlow::before\s*{[\s\S]*?background:\s*linear-gradient\(90deg,\s*#fff 40%,\s*transparent 40%\);[\s\S]*?background-size:\s*200% 4px;[\s\S]*?filter:\s*drop-shadow\(0 0 8px #fff\);/);
    expect(scss).toMatch(/@keyframes beforeLineAnim\s*{[\s\S]*?45%,\s*50%\s*{[\s\S]*?background-position:\s*-100% 0;[\s\S]*?}[\s\S]*?50%,\s*95%\s*{[\s\S]*?transform:\s*scale\(1,\s*-1\);/);
    expect(scss).toMatch(/\.pileFooter\s+\.pileSubmitButton\.submitGlow::before\s*{[\s\S]*?animation:\s*beforeLineAnim 5\.4s linear infinite;/);
    expect(scss).not.toMatch(/pileSubmitRailAfterLineAnim/);
    expect(scss).not.toMatch(/\.pileFooter\s+\.pileSubmitButton\.submitGlow::after/);
    expect(scss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/);
  });

  it('ports the recovered animLine border motion onto the SurveySelector header submit CTA', () => {
    const scss = readSurveyToolScss();
    const normalizedScss = normalizeScssContract(scss);

    expect(scss).toMatch(/\.headerSubmitButton\s*{[\s\S]*?position:\s*relative;[\s\S]*?isolation:\s*isolate;[\s\S]*?overflow:\s*visible;/);
    expect(normalizedScss).toMatch(/\.headerSubmitButton\s*{[\s\S]*?&\.submitGlow::before\s*{[\s\S]*?background:\s*linear-gradient\(90deg,\s*#fff 40%,\s*transparent 40%\);[\s\S]*?background-size:\s*200% 4px;[\s\S]*?filter:\s*drop-shadow\(0 0 8px #fff\);[\s\S]*?pointer-events:\s*none;/);
    expect(scss).toMatch(/\.headerSubmitButton\s*{[\s\S]*?&\.submitGlow::before\s*{[\s\S]*?animation:\s*beforeLineAnim 5\.4s linear infinite;/);
    expect(scss).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.headerSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/);
  });

  it('keeps pile action opacity scoped to buttons and anchors the mini spinner outside the controls stack', () => {
    const scss = readSurveyToolScss();
    const pileActionsBlocks = scss.match(/\.pileActions\s*{[^}]*}/g) || [];

    expect(pileActionsBlocks.length).toBeGreaterThanOrEqual(2);
    pileActionsBlocks.forEach((block) => {
      expect(block).not.toMatch(/opacity\s*:/);
    });
    expect(scss).not.toMatch(/\.pileActionsActive\s*{/);
    expect(scss).toMatch(/\.actionButton\s*{[\s\S]*?opacity:\s*0\.15;/);
    expect(scss).toMatch(/\.actionButton\s*{[\s\S]*?transition:\s*[\s\S]*?opacity 0\.3s ease;/);
    expect(scss).toMatch(/\.pileActions:hover\s+\.actionButton\s*{[^}]*opacity:\s*1;/);
    expect(scss).toMatch(/\.actionButtonActive\s*{[\s\S]*?opacity:\s*1;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.actionButton\s*{[\s\S]*?font-size:\s*1\.4rem;[\s\S]*?opacity:\s*0\.14;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.actionButtonActive\s*{[\s\S]*?opacity:\s*0\.75;/);
    expect(scss).toMatch(/@media \(hover: none\), \(pointer: coarse\)\s*{[\s\S]*?\.actionButton\s*{[\s\S]*?opacity:\s*0\.14;/);
    expect(scss).toMatch(/@media \(hover: none\), \(pointer: coarse\)\s*{[\s\S]*?\.actionButtonActive\s*{[\s\S]*?opacity:\s*0\.75;/);
    expect(scss).toMatch(/\.miniSpinnerWrapper\s*{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*2;/);
    expect(scss).not.toMatch(/\.miniSpinnerWrapper\s*{[\s\S]*?margin-bottom:\s*5px;/);
  });

  it('keeps non-multichoice pile question types vertically centered within the card body', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.binaryQuestionContainer,\s*\.ratingQuestionContainer,\s*\.freeformQuestionContainer\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;/);
  });

  it('keeps embedded listening-mode question authoring readable on the light panel', () => {
    const scss = readSurveyToolScss();
    const listeningCreateWrap = scss.match(/\.sessionListeningCreateWrap\s*{[\s\S]*?^}/m)?.[0] || '';
    const normalizedListeningCreateWrap = normalizeScssContract(listeningCreateWrap);

    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='createSurveyContainer'\]\)\s*{[\s\S]*?background:\s*#edf2f7\s*!important;[\s\S]*?color:\s*#18243a\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='questionPromptInput'\]\),[\s\S]*?background:\s*#fff\s*!important;[\s\S]*?color:\s*#18243a\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='questionContainer'\]\),[\s\S]*?background:\s*#fff\s*!important;[\s\S]*?color:\s*#18243a\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='toggleLabel'\]\),[\s\S]*?color:\s*#18243a\s*!important;[\s\S]*?opacity:\s*1\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='typeButton'\]\)\s*{[\s\S]*?background:\s*#f8fafc\s*!important;[\s\S]*?color:\s*#18243a\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='removeQuestionButton'\]\),[\s\S]*?background:\s*#fff\s*!important;[\s\S]*?color:\s*#18243a\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='tagInputField'\]\)\s*{[\s\S]*?color:\s*#18243a\s*!important;/);
    expect(normalizedListeningCreateWrap).toMatch(/:global\(\[class\*='filterBubble'\]\)\s*{[\s\S]*?background:\s*#dff7ea\s*!important;[\s\S]*?color:\s*#123a2d\s*!important;/);
  });

  it('keeps listening mode from changing the pile card vertical layout', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.pileListeningLayout\s*{[\s\S]*?position:\s*relative;[\s\S]*?width:\s*100%;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;/);
    expect(scss).toMatch(/\.pileListeningLayout \.pileWrapper\s*{[\s\S]*?width:\s*100%;[\s\S]*?margin-bottom:\s*38px;/);
    expect(scss).toMatch(/\.sessionListeningPanelAnchor\s*{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*clamp\(16px,\s*3vw,\s*36px\);[\s\S]*?pointer-events:\s*none;/);
    expect(scss).toMatch(/\.sessionListeningPanel\s*{[\s\S]*?max-height:\s*calc\(100vh - 32px\);[\s\S]*?overflow-y:\s*auto;/);
    expect(scss).toMatch(/@media \(max-width: 1100px\)\s*{[\s\S]*?\.sessionListeningPanelAnchor\s*{[\s\S]*?position:\s*static;[\s\S]*?pointer-events:\s*auto;/);
  });

  it('keeps listening mode record-first and uses copied HealthBot waveform controls while recording', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.sessionListeningRecordButton\s*{[\s\S]*?width:\s*132px;[\s\S]*?height:\s*132px;[\s\S]*?border-radius:\s*50% !important;/);
    expect(scss).toMatch(/\.sessionListeningActiveRecorder\s*{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*10px;[\s\S]*?background-color:\s*#f9f9f9;/);
    expect(scss).toMatch(/\.sessionListeningWaveformShell\s*{[\s\S]*?height:\s*80px;[\s\S]*?border:\s*2px inset #808080;[\s\S]*?background-color:\s*#c0c0c0;/);
    expect(scss).toMatch(/\.sessionListeningWaveformCanvas\s*{[\s\S]*?image-rendering:\s*pixelated;/);
    expect(scss).toMatch(/\.sessionListeningAudioButton\s*{[\s\S]*?width:\s*61px;[\s\S]*?height:\s*61px;[\s\S]*?background:\s*linear-gradient\(#dfdfdf,\s*#ffffff\);/);
    expect(scss).not.toMatch(/\.sessionListeningPrimary\s*{/);
    expect(scss).not.toMatch(/\.sessionListeningControls\s*{/);
  });

  it('keeps listening transcripts behind a compact button and clearable from an overlay control', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.sessionListeningTranscriptButton\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?border-radius:\s*var\(--ce-radius-pill\);[\s\S]*?cursor:\s*pointer;/);
    expect(scss).toMatch(/\.sessionListeningTranscriptDetails\s*{[\s\S]*?background:\s*#fff;[\s\S]*?overflow:\s*hidden;/);
    expect(scss).toMatch(/\.sessionListeningTranscriptShell\s*{[\s\S]*?position:\s*relative;/);
    expect(scss).toMatch(/\.sessionListeningTranscript\s*{[\s\S]*?padding:\s*10px 42px 10px 12px;/);
    expect(scss).toMatch(/\.sessionListeningClearTranscript\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*8px;[\s\S]*?right:\s*18px;/);
  });

  it('keeps pile multichoice options horizontally scrollable while anchoring the first column to the left edge', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.multichoiceQuestionContainer\s*{[\s\S]*?align-items:\s*flex-start;[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*hidden;/);
    expect(scss).toMatch(/\.multichoiceQuestionContainer #multiChoice\s*{[\s\S]*?flex-direction:\s*column;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?align-content:\s*flex-start;[\s\S]*?align-items:\s*flex-start;[\s\S]*?width:\s*max-content;/);
    expect(scss).toMatch(/\.multichoiceQuestionContainer #multiChoice \.checkboxOptionText\s*{[\s\S]*?width:\s*auto;[\s\S]*?align-self:\s*flex-start;/);
    expect(scss).toMatch(/@media \(max-width: 480px\)\s*{[\s\S]*?\.multichoiceQuestionContainer #multiChoice\s*{[\s\S]*?max-width:\s*70%;/);
  });

  it('keeps single-question page chrome on the prior inherited font treatment', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.singleQuestionPage\s*{[\s\S]*?font-family:\s*inherit;/);
    expect(scss).toMatch(/\.singleQuestionJsonToggle\s*{[\s\S]*?font-family:\s*inherit;[\s\S]*?font-size:\s*0\.95rem;[\s\S]*?letter-spacing:\s*0\.06em;[\s\S]*?opacity:\s*0\.5;/);
    expect(scss).toMatch(/\.singleQuestionJsonToggleQuestion\s*{[\s\S]*?rgba\(94,\s*114,\s*228,\s*0\.12\)/);
    expect(scss).toMatch(/\.singleQuestionJsonToggleResponse\s*{[\s\S]*?rgba\(77,\s*255,\s*164,\s*0\.1\)/);
    expect(scss).toMatch(/#answerSurveyButton\s*{[\s\S]*?font-family:\s*inherit;/);
    expect(scss).toMatch(/\.viewAddressHeadingSuffix\s*{[\s\S]*?margin-left:\s*0\.35rem;/);
  });

  it('keeps the pile hologram styled as a full-card takeover', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.pileHologramToggle\s*{[\s\S]*?position:\s*absolute;[\s\S]*?opacity:\s*0\.5;/);
    expect(scss).toMatch(/\.pileHologramPanel\s*{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*400px;/);
  });
});
