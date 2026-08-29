import fs from 'fs';
import path from 'path';
import { normalizeScssContract } from 'testUtils/scssContractAssertions';

const readSurveyToolScss = () => fs.readFileSync(path.join(__dirname, 'SurveyTool.module.scss'), 'utf8');

const readAudioInputScss = () =>
  fs.readFileSync(path.join(__dirname, '../Shared/AudioInput/AudioInput.module.scss'), 'utf8');

const readFinalSubmitCtaScss = () => fs.readFileSync(path.join(__dirname, '../../scss/_finalSubmitCta.scss'), 'utf8');

describe('SurveyTool styles', () => {
  it('keeps the compact interview modal readable and its icon controls normally sized', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.sessionVoiceModeModal\s*\{[\s\S]*?background:\s*var\(--ce-surface-sunken\) !important;[\s\S]*?color:\s*var\(--ce-panel-text\) !important;[\s\S]*?border:\s*1px solid var\(--ce-card-border\) !important;/,
    );
    expect(scss).toMatch(
      /\.sessionVoiceModeModal\s*\{[\s\S]*?max-height:\s*min\(90vh, 900px\);[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(
      /:global\(\.modal-body\)\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(scss).toMatch(
      /:global\(\.modal-header\) :global\(\.btn-close\)\s*\{[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;/,
    );
    expect(scss).toMatch(
      /:global\(\.modal-title\)\s*\{[\s\S]*?font-size:\s*clamp\(1\.35rem, 2\.4vw, 1\.6rem\);[\s\S]*?font-weight:\s*800;/,
    );
    expect(scss).toMatch(
      /\.sessionVoiceModeChooser\s*\{[\s\S]*?button:hover,[\s\S]*?strong,[\s\S]*?span,[\s\S]*?svg\s*\{[\s\S]*?color:\s*var\(--ce-action-accent-text\) !important;/,
    );
    expect(scss).toMatch(
      /\.sessionAgentKickoffCopy\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*8px;[\s\S]*?right:\s*8px;[\s\S]*?width:\s*32px;[\s\S]*?height:\s*32px;/,
    );
    expect(scss).toMatch(
      /\.sessionAgentKickoffToggle\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*10px;[\s\S]*?bottom:\s*8px;[\s\S]*?opacity:\s*0\.5;[\s\S]*?&:hover,[\s\S]*?&:focus-visible\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?&\[aria-expanded='true'\]\s*\{[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.sessionAgentKickoffCaretExpanded\s*\{[\s\S]*?transform:\s*rotate\(180deg\);/,
    );
    expect(scss).toMatch(
      /\.sessionAgentKickoffPrompt\s*\{[\s\S]*?white-space:\s*normal;[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?opacity:\s*0\.5;/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewStatusDot\s*\{[\s\S]*?border-radius:\s*var\(--ce-radius-round\);[\s\S]*?background:\s*var\(--ce-status-success\);/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewStatusDotError\s*\{[\s\S]*?background:\s*var\(--ce-status-error\);/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewMappingNotice\s*\{[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--ce-status-warning\) 58%, var\(--ce-card-border\)\);[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-status-warning\) 12%, var\(--ce-surface-sunken\)\);[\s\S]*?color:\s*var\(--ce-panel-text\);/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewTranscriptToggle\s*\{[\s\S]*?color:\s*var\(--ce-panel-text\);[\s\S]*?&:hover,[\s\S]*?color:\s*var\(--ce-action-accent\);/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewTranscript\s*\{[\s\S]*?background:\s*var\(--ce-input-bg\);[\s\S]*?color:\s*var\(--ce-panel-text\);[\s\S]*?white-space:\s*pre-wrap;/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewConfidenceTrack\s*\{[\s\S]*?height:\s*9px;[\s\S]*?overflow:\s*hidden;[\s\S]*?border-radius:\s*var\(--ce-radius-round\);/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewReviewActions\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*-18px;[\s\S]*?justify-content:\s*space-between;/,
    );
    expect(scss).toMatch(
      /\.sessionInterviewAnswerInput\s*\{[\s\S]*?background:\s*var\(--ce-input-bg\) !important;[\s\S]*?color:\s*var\(--ce-panel-text\) !important;[\s\S]*?opacity:\s*1;/,
    );

    const audioScss = readAudioInputScss();
    expect(audioScss).toMatch(
      /\.audioTextarea\s*\{[\s\S]*?color:\s*var\(--ce-panel-text, var\(--ce-text\)\);[\s\S]*?caret-color:\s*var\(--ce-panel-text, var\(--ce-text\)\);/,
    );
  });

  it('keeps binary responses on their dedicated green, yellow, and red theme palette', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/&\.agree\s*{[\s\S]*?background-color:\s*var\(--ce-binary-choice-agree-bg\);/);
    expect(scss).toMatch(/&\.unsure\s*{[\s\S]*?background-color:\s*var\(--ce-binary-choice-unsure-bg\);/);
    expect(scss).toMatch(/&\.disagree\s*{[\s\S]*?background-color:\s*var\(--ce-binary-choice-disagree-bg\);/);
  });

  it('renders classic pile questions as compact desktop dialogs', () => {
    const scss = readSurveyToolScss();

    expect(scss).toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(scss).not.toContain('data-ce-theme');
    expect(scss).not.toContain('.pileWindowTitlebar');
    expect(scss).not.toContain('.pileWindowClose');
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileCardInner\s*{[\s\S]*?height:\s*400px;[\s\S]*?margin-top:\s*0;/,
    );
    expect(scss).not.toContain('padding: 54px 28px 18px;');
    expect(scss).not.toContain('padding: 52px 14px 12px;');
    expect(scss).toMatch(
      /\.pileCardHeader\s*{[\s\S]*?border-color:\s*var\(--ce-border-inset\);[\s\S]*?background:\s*var\(--ce-document-surface\);/,
    );
    expect(scss).toMatch(
      /#binaryChoice \.radioOptionText\s*{[\s\S]*?background:\s*var\(--ce-control-face\);[\s\S]*?box-shadow:\s*var\(--ce-shadow-raised\);/,
    );
  });

  it('renders classic full-question utility icons as one quiet borderless family', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.fullQuestionBody \.iconButton,\s*\.fullQuestionBody \.cardLinkButton\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?color:\s*var\(--ce-control-text\) !important;[\s\S]*?opacity:\s*0\.5 !important;/,
    );
    expect(scss).toMatch(/\.fullQuestionBody \.iconButtonActive\s*{[\s\S]*?opacity:\s*0\.5 !important;/);
    expect(scss).toMatch(
      /\.fullQuestionBody \.fullQuestionBookmarkButtonActive,\s*\.fullQuestionBody \.fullQuestionBookmarkButtonActive:hover,\s*\.fullQuestionBody \.fullQuestionBookmarkButtonActive:focus-visible\s*{[\s\S]*?color:\s*var\(--ce-status-warning\) !important;[\s\S]*?opacity:\s*1 !important;/,
    );
    expect(scss).toMatch(
      /\.fullQuestionBody \.iconButton svg,\s*\.fullQuestionBody \.cardLinkButton svg\s*{[\s\S]*?color:\s*currentColor !important;[\s\S]*?filter:\s*none !important;[\s\S]*?text-shadow:\s*none !important;/,
    );
    expect(scss).toMatch(
      /\.fullQuestionBody \.iconButton:hover:not\(:disabled\),[\s\S]*?\.fullQuestionBody \.cardLinkButton:focus-visible\s*{[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.fullQuestionBody \.iconButton:disabled\s*{[\s\S]*?color:\s*var\(--ce-control-disabled-text\) !important;[\s\S]*?opacity:\s*0\.58;/,
    );
  });

  it('renders classic pile utility controls as borderless standalone icons', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?padding:\s*0;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileNavArrow,\s*\.actionButton\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileCardFooter \.pileIconButton,\s*\.pileCardFooter \.iconButton\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?opacity:\s*0\.5 !important;/,
    );
    expect(scss).toMatch(
      /\.pileCardFooter \.pileIconButton:hover:not\(:disabled\),[\s\S]*?\.pileCardFooter \.pileLockButtonMenuOpen\s*{[\s\S]*?opacity:\s*1 !important;/,
    );
    expect(scss).toMatch(
      /\.pileNavArrow:focus-visible,[\s\S]*?\.pileCardFooter \.iconButton:focus-visible\s*{[\s\S]*?outline:\s*2px dotted var\(--ce-control-text\);[\s\S]*?outline-offset:\s*2px;/,
    );
  });

  it('keeps pile-card footer utility controls borderless in every app theme', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.pileCardFooter \.pileIconButton,\s*\.pileCardFooter \.iconButton\s*\{[\s\S]*?-webkit-appearance:\s*none;[\s\S]*?appearance:\s*none;[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
    );
    expect(scss).toMatch(
      /\.pileCardFooter \.pileIconButton:focus-visible,\s*\.pileCardFooter \.iconButton:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--ce-focus-ring\);[\s\S]*?outline-offset:\s*2px;/,
    );
  });

  it('keeps compact Classic 95 question actions visible without covering the lower panels', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.pileInteractionUnit\s*{[\s\S]*?--pile-card-width:\s*min\(720px, calc\(100vw - 76px\)\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?position:\s*static;[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*auto minmax\(180px, 1fr\) auto;[\s\S]*?grid-template-areas:\s*['"]actions footer nav['"];[\s\S]*?overflow:\s*visible;/,
    );
    expect(scss).toMatch(/\.pileActionsMenuEligible \.pileActionMenuToggle\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(
      /\.pileActionsMenuEligible \.pileActionButtonGroup,[\s\S]*?\.pileActionsMenuEligible:hover \.pileActionButtonGroup\s*{[\s\S]*?position:\s*static;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*row;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{\s*@container ce-theme style\(--ce-layout-profile: desktop-window\)\s*{[\s\S]*?\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?color:\s*var\(--ce-color-white\);/,
    );
    expect(scss).toMatch(
      /\.pileActions \.pileActionButtonGroup \.actionButton\s*{[\s\S]*?width:\s*48px;[\s\S]*?height:\s*48px;[\s\S]*?color:\s*var\(--ce-color-white\) !important;[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.pileNav \.pileNavArrow,\s*\.pileNav \.pileNavCounterText\s*{[\s\S]*?color:\s*var\(--ce-color-white\) !important;/,
    );
  });

  it('keeps the Classic 95 side rail large and white at every viewport width', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?top:\s*44%;/,
    );
    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileNavArrow,\s*\.actionButton\s*{[\s\S]*?width:\s*48px;[\s\S]*?height:\s*48px;[\s\S]*?color:\s*var\(--ce-color-white\) !important;[\s\S]*?font-size:\s*2rem;/,
    );
    expect(scss).toMatch(
      /\.pileNavArrow:disabled,\s*\.actionButton:disabled\s*{[\s\S]*?color:\s*var\(--ce-color-white\) !important;[\s\S]*?opacity:\s*0\.5;/,
    );
  });

  it('keeps classic conviction sliders readable and gives the lock-audience popover a raised boundary', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*{[\s\S]*?\.pileCardFooter \.importanceSlider\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?opacity:\s*1 !important;/,
    );
    expect(scss).toMatch(
      /\.pileCardFooter \.importanceText,[\s\S]*?\.lockAudiencePopover \.lockAudienceCaretButton\s*{[\s\S]*?color:\s*var\(--ce-control-text\) !important;[\s\S]*?opacity:\s*1 !important;/,
    );
    expect(scss).toMatch(
      /\.pileCardFooter \.convictionToggleLine,\s*\.lockAudiencePopover \.convictionToggleLine\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.pileCardFooter \.convictionSlider\s*{[\s\S]*?background:\s*var\(--ce-input-bg\);[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.lockAudiencePopover\s*{[\s\S]*?border:\s*var\(--ce-border-control-width\) solid !important;[\s\S]*?border-color:\s*var\(--ce-border-raised\) !important;[\s\S]*?background:\s*var\(--ce-surface-raised\);[\s\S]*?box-shadow:\s*var\(--ce-shadow-raised\) !important;[\s\S]*?color:\s*var\(--ce-control-text\);[\s\S]*?backdrop-filter:\s*none;/,
    );
  });

  it('keeps full-question conviction controls in parity with the classic pile treatment', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /@container ce-theme style\(--ce-layout-profile:\s*desktop-window\)\s*\{[\s\S]*?\.fullQuestionFooter \.importanceSlider,[\s\S]*?\.pileCardFooter \.importanceSlider\s*\{[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?opacity:\s*1 !important;/,
    );
    expect(scss).toMatch(
      /\.fullQuestionFooter \.importanceText,[\s\S]*?\.fullQuestionFooter \.convictionToggleLine,[\s\S]*?\.pileCardFooter \.importanceText,[\s\S]*?color:\s*var\(--ce-control-text\) !important;[\s\S]*?opacity:\s*1 !important;/,
    );
    expect(scss).toMatch(
      /\.fullQuestionFooter \.convictionToggleLine,[\s\S]*?\.pileCardFooter \.convictionToggleLine,[\s\S]*?border:\s*0 !important;[\s\S]*?background:\s*transparent !important;[\s\S]*?box-shadow:\s*none !important;/,
    );
    expect(scss).toMatch(
      /\.fullQuestionFooter \.convictionSlider,[\s\S]*?\.pileCardFooter \.convictionSlider\s*\{[\s\S]*?background:\s*var\(--ce-input-bg\);[\s\S]*?opacity:\s*1;/,
    );
  });

  it('uses readable authoring controls across the questions toolbar', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#surveysRow\s*{[\s\S]*?background:\s*var\(--ce-authoring-section-bg\);/);
    expect(scss).toMatch(
      /@media \(min-width:\s*601px\) and \(max-width:\s*768px\)\s*{[\s\S]*?#surveysRow\s*{[^}]*justify-content:\s*space-between;[\s\S]*?#createSurveyButton\s*{[^}]*margin-left:\s*0 !important;/,
    );
    expect(scss).toMatch(/#dropdownToggle\s*{[\s\S]*?color:\s*var\(--ce-authoring-control-text\);/);
    expect(scss).toMatch(/#filterButton\s*{[\s\S]*?background:\s*var\(--ce-authoring-control-bg\);/);
    expect(scss).toMatch(/#showResultsButton\s*{[\s\S]*?color:\s*var\(--ce-authoring-control-text\);/);
    expect(scss).toMatch(/#createSurveyButton\s*{[\s\S]*?opacity:\s*1;/);
  });

  it('widens the embedded session toolbar and centers its wrapped controls on tablets', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#surveysRow\.embeddedSessionToolbar\s*{[^}]*margin-top:\s*0;/);
    expect(scss).toMatch(
      /@media \(min-width:\s*601px\) and \(max-width:\s*768px\)\s*{[\s\S]*?#surveysRow\.embeddedSessionToolbar\s*{[^}]*box-sizing:\s*border-box;[^}]*width:\s*calc\(100% \+ 70px\);[^}]*margin-left:\s*-35px;[^}]*margin-right:\s*-35px;[^}]*padding-left:\s*10px;[^}]*padding-right:\s*10px;[^}]*column-gap:\s*8px;/,
    );
    expect(scss).toMatch(
      /#surveysRow\.embeddedSessionToolbar\s*{[\s\S]*?\.headerSubmitButton\s*{[^}]*margin-left:\s*0;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*601px\) and \(max-width:\s*730px\)\s*{[\s\S]*?#surveysRow\.embeddedSessionToolbar\s*{[^}]*justify-content:\s*center;/,
    );
  });

  it('keeps pile question prompts readable on theme-provided card surfaces', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#questionTitle\s*{[^}]*color:\s*var\(--ce-panel-text\)\s*!important;/);
    expect(scss).not.toMatch(/#questionTitle\s*{[^}]*color:\s*var\(--ce-color-white\)\s*!important;/);
    expect(scss).toMatch(
      /\.pileCardHeader #questionTitle\s*{[^}]*font-family:\s*var\(--ce-font-body\);[^}]*font-weight:\s*400;[^}]*letter-spacing:\s*normal;/,
    );
  });

  it('keeps existing-response light-panel CTAs on dark text for readability', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#startFreshButton\s*{[^}]*color:\s*var\(--ce-document-text\);/);
    expect(scss).toMatch(/#exitEditingButton\s*{[^}]*color:\s*var\(--ce-document-text\);/);
    expect(scss).toMatch(
      /#exitEditingButton[\s\S]*?&:disabled\s*{[^}]*color:\s*color-mix\(in srgb, var\(--ce-overlay-surface\) 50%, transparent\);/,
    );
    expect(scss).not.toMatch(/#startFreshButton\s*{[^}]*color:\s*var\(--ce-color-white\);/);
    expect(scss).not.toMatch(/#exitEditingButton\s*{[^}]*color:\s*var\(--ce-color-white\);/);
  });

  it('removes the old SurveyTool session selector overlay styles', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/#surveysRow\s*{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*10px;[\s\S]*?z-index:\s*20;/);
    expect(scss).not.toMatch(/\.sessionSelectorTriggerRow\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorBackdrop\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorPopover\s*{/);
    expect(scss).not.toMatch(/\.surveySelectorRowSessionSelectorOpen\s*{/);
  });

  it('keeps the locked-question decrypt CTA readable on the light banner', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/%decryptCtaOutlineOnLight\s*{[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/);
    expect(scss).toMatch(
      /%decryptCtaOutlineOnLight\s*{[\s\S]*?&:hover:not\(:disabled\),[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(scss).toMatch(
      /%decryptCtaOutlineOnLight\s*{[\s\S]*?&:disabled\s*{[\s\S]*?color:\s*color-mix\(in srgb, var\(--ce-overlay-surface\) 52%, transparent\)\s*!important;/,
    );
    expect(scss).toMatch(/\.lockedQuestionsDecryptButton\s*{\s*@extend\s+%decryptCtaOutlineOnLight;/);
    expect(scss).not.toMatch(/\.lockedQuestionsDecryptButton\s*{\s*@extend\s+%decryptCtaOutline;/);
  });

  it('keeps the questions selector encrypted badge aligned with the title copy', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.questionSelectorSummary\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
    expect(scss).toMatch(
      /\.questionSelectorEncryptedBadge\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/,
    );
    expect(scss).toMatch(/\.questionSelectorSpinner\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?align-items:\s*center;/);
  });

  it('keeps the additional-comments lock inline with the input field', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.additionalCommentsInlineRow\s*{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*flex-start;[\s\S]*?width:\s*100%;/,
    );
    expect(scss).toMatch(/\.additionalCommentsInputWrap\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;/);
    expect(scss).toMatch(/\.additionalCommentsLockSlot\s*{[\s\S]*?display:\s*flex;[\s\S]*?padding-top:\s*10px;/);
  });

  it('keeps the pile lock popover readable without inheriting the footer icon opacity', () => {
    const scss = readSurveyToolScss();
    const pileCardIconsBlock = scss.match(/\.pileCardIcons\s*{[^}]*}/)?.[0] || '';

    expect(pileCardIconsBlock).not.toMatch(/opacity\s*:/);
    expect(scss).toMatch(
      /\.pileLockButtonMenuOpen\s*{[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-overlay-base\) 78%, transparent\);/,
    );
    expect(scss).toMatch(
      /\.pileLockAudiencePopover\s*{[\s\S]*?background:\s*color-mix\(in srgb, var\(--ce-overlay-base\) 80%, transparent\);/,
    );
    expect(scss).toMatch(/\.pileLockAudiencePopover\s*{[\s\S]*?opacity:\s*0\.8;/);
  });

  it('keeps the single-question submit button stacked below the card', () => {
    const scss = readSurveyToolScss();
    const sharedCta = readFinalSubmitCtaScss();

    expect(scss).toMatch(
      /#surveyFooter\.singleQuestionSubmitFooter\s*{[\s\S]*?position:\s*static;[\s\S]*?align-self:\s*center;[\s\S]*?width:\s*min\(360px,\s*100%\);[\s\S]*?margin:\s*18px auto 0;[\s\S]*?display:\s*flex;/,
    );
    expect(sharedCta).toMatch(
      /@mixin final-submit-cta-shell\s*\([\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?background-color:\s*var\(--ce-action-submit\) !important;[\s\S]*?border:\s*1px solid var\(--ce-action-submit\) !important;[\s\S]*?background-color:\s*var\(--ce-action-submit-hover\) !important;[\s\S]*?transform:\s*translateY\(-2px\);[\s\S]*?&:disabled\s*{[\s\S]*?color:\s*var\(--ce-action-submit-disabled-text\) !important;/,
    );
    expect(sharedCta).toMatch(
      /@mixin final-submit-cta-content\(\$gap: 12px\)\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?width:\s*100%;[\s\S]*?text-transform:\s*uppercase;/,
    );
    expect(scss).toMatch(/#submitSurveyButton\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-shell\(/);
    expect(scss).toMatch(
      /#submitSurveyButton\.singleQuestionSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*72px;[\s\S]*?font-size:\s*1\.4rem;[\s\S]*?border-radius:\s*var\(--ce-radius-12\);/,
    );
    expect(scss).toMatch(
      /\.singleQuestionSubmitButtonContent\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-content\(\$gap:\s*14px\);[\s\S]*?text-transform:\s*uppercase;/,
    );
    expect(scss).toMatch(/\.singleQuestionSubmitButtonIcon\s*{[\s\S]*?font-size:\s*1\.5em;/);
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?#surveyFooter\.singleQuestionSubmitFooter\s*{[\s\S]*?width:\s*100%;[\s\S]*?flex-direction:\s*column;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?#submitSurveyButton\.singleQuestionSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?opacity:\s*1;/,
    );
  });

  it('keeps pile submit controls responsive across desktop, medium-desktop, medium, and small breakpoints', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.pileWrapper\s*{[\s\S]*?margin-bottom:\s*38px;/);
    expect(scss).toMatch(/\.pileSubmitButton\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-shell\(/);
    expect(scss).toMatch(
      /\.pileSubmitButtonContent\s*{[\s\S]*?@include finalSubmitCta\.final-submit-cta-content\(\$gap:\s*12px\);[\s\S]*?text-transform:\s*uppercase;/,
    );
    expect(scss).toMatch(
      /\.pileInteractionUnit\s*{[\s\S]*?--pile-desktop-submit-rail-offset:\s*42px;[\s\S]*?--pile-desktop-rail-gap:\s*24px;[\s\S]*?--pile-card-width:\s*min\(550px,\s*90vw\);[\s\S]*?display:\s*flex;[\s\S]*?position:\s*relative;[\s\S]*?width:\s*var\(--pile-card-width\);[\s\S]*?max-width:\s*90vw;/,
    );
    expect(scss).toMatch(
      /\.pileCardContainer\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?position:\s*relative;/,
    );
    expect(scss).not.toMatch(/\.pileInteractionUnitWithSubmitRail\s*{/);
    expect(scss).toMatch(
      /\.pileControls\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*0;[\s\S]*?right:\s*0;[\s\S]*?bottom:\s*0;[\s\S]*?left:\s*0;[\s\S]*?width:\s*100%;/,
    );
    expect(scss).not.toMatch(/grid-template-areas:\s*[\s\S]*?'nav submit'[\s\S]*?'actions submit'/);
    expect(scss).toMatch(
      /\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?position:\s*absolute;[\s\S]*?left:\s*calc\(100% \+ var\(--pile-desktop-rail-gap\)\);/,
    );
    expect(scss).toMatch(
      /\.pileControls > \.pileActions\s*{[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(0\.625rem\);/,
    );
    expect(scss).toMatch(
      /\.pileControls > \.pileNav\s*{[\s\S]*?top:\s*50%;[\s\S]*?transform:\s*translateY\(calc\(-100% - 0\.625rem\)\);/,
    );
    expect(scss).toMatch(
      /\.pileFooter\s*{[\s\S]*?justify-content:\s*center;[\s\S]*?width:\s*min\(550px,\s*90vw\);[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(-1 \* var\(--pile-desktop-submit-rail-offset\)\);[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translateX\(-50%\);/,
    );
    expect(scss).toMatch(
      /\.pileFooterHidden\s*{[\s\S]*?opacity:\s*0;[\s\S]*?visibility:\s*hidden;[\s\S]*?pointer-events:\s*none;/,
    );
    expect(scss).toMatch(
      /\.pileFooter\s+\.pileSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*60px;[\s\S]*?font-size:\s*1\.15rem;/,
    );
    expect(scss).toMatch(
      /\.pileSubmitSuccessBadge\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?width:\s*60px;[\s\S]*?height:\s*60px;[\s\S]*?border-radius:\s*var\(--ce-radius-round\);/,
    );
    expect(scss).toMatch(/\.pileSubmitButtonTrail\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(/\.actionButton\.pileActionMenuToggle\s*{[\s\S]*?display:\s*none;/);
    expect(scss).toMatch(/\.pileActionButtonGroup\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
    expect(scss).toMatch(/\.miniSpinnerWrapper\s*{[\s\S]*?top:\s*-30px;[\s\S]*?right:\s*-75px;/);
    expect(scss).toMatch(/\.pileHologramToggle\s*{[\s\S]*?top:\s*6px;[\s\S]*?right:\s*16px;/);
    expect(scss).toMatch(
      /@media \(min-width: 1367px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?top:\s*-50px;[\s\S]*?right:\s*32px;[\s\S]*?left:\s*0;[\s\S]*?width:\s*auto;[\s\S]*?transform:\s*none;/,
    );
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileWrapper\s*{[\s\S]*?margin-bottom:\s*0;/);
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileInteractionUnit\s*{[\s\S]*?width:\s*var\(--pile-card-width\);[\s\S]*?max-width:\s*90vw;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileControls > \.pileActions,\s*\.pileControls > \.pileNav\s*{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?position:\s*static;[\s\S]*?transform:\s*none;[\s\S]*?justify-content:\s*center;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?align-items:\s*center;[\s\S]*?width:\s*100%;[\s\S]*?margin-top:\s*35px;[\s\S]*?gap:\s*20px;/,
    );
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActions\s*{[\s\S]*?order:\s*1;/);
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionButtonGroup\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?gap:\s*16px;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionsMenuEligible\s*{[\s\S]*?position:\s*relative;[\s\S]*?flex:\s*0 0 auto;[\s\S]*?overflow:\s*visible;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionsMenuEligible \.pileActionMenuToggle\s*{[\s\S]*?display:\s*flex;[\s\S]*?background:\s*transparent;[\s\S]*?border:\s*none;[\s\S]*?box-shadow:\s*none;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileActionsMenuEligible \.pileActionButtonGroup\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*calc\(100% \+ 10px\);[\s\S]*?display:\s*none;[\s\S]*?flex-direction:\s*column;/,
    );
    expect(scss).toMatch(
      /\.pileActionsMenuEligible:focus-within \.pileActionButtonGroup,\s*[\s\S]*?\.pileActionsMenuEligible:hover \.pileActionButtonGroup\s*{[\s\S]*?display:\s*flex;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?order:\s*2;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*none;[\s\S]*?margin-right:\s*8px;[\s\S]*?gap:\s*12px;/,
    );
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.pileNav\s*{[\s\S]*?order:\s*3;/);
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?min-width:\s*0;[\s\S]*?font-size:\s*1rem;/,
    );
    expect(scss).not.toContain('gap: 18px 12px;');
    expect(scss).not.toContain('top: -52px;');
    expect(scss).not.toContain('min-height: 54px;');
    expect(scss).toMatch(
      /@media \(max-width: 480px\)\s*{[\s\S]*?\.pileControls\s*{[\s\S]*?gap:\s*10px;[\s\S]*?padding:\s*0 6px;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 480px\)\s*{[\s\S]*?\.pileFooter\s*{[\s\S]*?flex:\s*1 1 190px;[\s\S]*?gap:\s*8px;[\s\S]*?margin-right:\s*0;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 480px\)\s*{[\s\S]*?\.pileNav\s*{[\s\S]*?gap:\s*8px;[\s\S]*?padding:\s*6px 4px;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 480px\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*none;[\s\S]*?min-width:\s*150px;[\s\S]*?min-height:\s*0;[\s\S]*?padding:\s*12px 18px;[\s\S]*?font-size:\s*1rem;[\s\S]*?border-radius:\s*var\(--ce-radius-8\);/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 480px\)\s*{[\s\S]*?\.pileSubmitSuccessBadge\s*{[\s\S]*?width:\s*54px;[\s\S]*?height:\s*54px;/,
    );
    expect(scss).toMatch(
      /@media \(min-width: 769px\)\s*{[\s\S]*?\.pileSubmitButtonTrail\s*{[\s\S]*?display:\s*inline-flex;/,
    );
    expect(scss).not.toMatch(/@media \(min-width: 769px\), \(max-width: 480px\)/);
  });

  it('ports the recovered animLine border motion onto pile submit rails at every size', () => {
    const scss = readSurveyToolScss();
    const normalizedScss = normalizeScssContract(scss);

    expect(normalizedScss).toMatch(
      /\.pileFooter\s+\.pileSubmitButton\.submitGlow::before\s*{[\s\S]*?background:\s*linear-gradient\(90deg,\s*var\(--ce-text-inverse\) 40%,\s*transparent 40%\);[\s\S]*?background-size:\s*200% 4px;[\s\S]*?filter:\s*drop-shadow\(0 0 8px var\(--ce-text-inverse\)\);/,
    );
    expect(scss).toMatch(
      /@keyframes beforeLineAnim\s*{[\s\S]*?45%,\s*50%\s*{[\s\S]*?background-position:\s*-100% 0;[\s\S]*?}[\s\S]*?50%,\s*95%\s*{[\s\S]*?transform:\s*scale\(1,\s*-1\);/,
    );
    expect(scss).toMatch(
      /\.pileFooter\s+\.pileSubmitButton\.submitGlow::before\s*{[\s\S]*?animation:\s*beforeLineAnim 5\.4s linear infinite;/,
    );
    expect(scss).not.toMatch(/pileSubmitRailAfterLineAnim/);
    expect(scss).not.toMatch(/\.pileFooter\s+\.pileSubmitButton\.submitGlow::after/);
    expect(scss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/,
    );
  });

  it('ports the recovered animLine border motion onto the SurveySelector header submit CTA', () => {
    const scss = readSurveyToolScss();
    const normalizedScss = normalizeScssContract(scss);

    expect(scss).toMatch(
      /\.headerSubmitButton\s*{[\s\S]*?position:\s*relative;[\s\S]*?isolation:\s*isolate;[\s\S]*?overflow:\s*visible;/,
    );
    expect(normalizedScss).toMatch(
      /\.headerSubmitButton\s*{[\s\S]*?&\.submitGlow::before\s*{[\s\S]*?background:\s*linear-gradient\(90deg,\s*var\(--ce-text-inverse\) 40%,\s*transparent 40%\);[\s\S]*?background-size:\s*200% 4px;[\s\S]*?filter:\s*drop-shadow\(0 0 8px var\(--ce-text-inverse\)\);[\s\S]*?pointer-events:\s*none;/,
    );
    expect(scss).toMatch(
      /\.headerSubmitButton\s*{[\s\S]*?&\.submitGlow::before\s*{[\s\S]*?animation:\s*beforeLineAnim 5\.4s linear infinite;/,
    );
    expect(scss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.headerSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/,
    );
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
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.actionButton\s*{[\s\S]*?font-size:\s*1\.4rem;[\s\S]*?opacity:\s*0\.14;/,
    );
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.actionButtonActive\s*{[\s\S]*?opacity:\s*0\.75;/);
    expect(scss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*{[\s\S]*?\.actionButton\s*{[\s\S]*?opacity:\s*0\.14;/,
    );
    expect(scss).toMatch(
      /@media \(hover: none\), \(pointer: coarse\)\s*{[\s\S]*?\.actionButtonActive\s*{[\s\S]*?opacity:\s*0\.75;/,
    );
    expect(scss).toMatch(/\.miniSpinnerWrapper\s*{[\s\S]*?position:\s*absolute;[\s\S]*?z-index:\s*2;/);
    expect(scss).not.toMatch(/\.miniSpinnerWrapper\s*{[\s\S]*?margin-bottom:\s*5px;/);
  });

  it('keeps non-multichoice pile question types vertically centered within the card body', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.binaryQuestionContainer,\s*\.ratingQuestionContainer,\s*\.freeformQuestionContainer\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;/,
    );
  });

  it('keeps embedded listening-mode question authoring readable on the light panel', () => {
    const scss = readSurveyToolScss();
    const listeningCreateWrap = scss.match(/\.sessionListeningCreateWrap\s*{[\s\S]*?^}/m)?.[0] || '';
    const normalizedListeningCreateWrap = normalizeScssContract(listeningCreateWrap);

    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='createSurveyContainer'\]\)\s*{[\s\S]*?background:\s*var\(--ce-document-surface\)\s*!important;[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='questionPromptInput'\]\),[\s\S]*?background:\s*var\(--ce-text-inverse\)\s*!important;[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='questionContainer'\]\),[\s\S]*?background:\s*var\(--ce-text-inverse\)\s*!important;[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='toggleLabel'\]\),[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;[\s\S]*?opacity:\s*1\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='typeButton'\]\)\s*{[\s\S]*?background:\s*var\(--ce-document-surface\)\s*!important;[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='removeQuestionButton'\]\),[\s\S]*?background:\s*var\(--ce-text-inverse\)\s*!important;[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='tagInputField'\]\)\s*{[\s\S]*?color:\s*var\(--ce-document-text\)\s*!important;/,
    );
    expect(normalizedListeningCreateWrap).toMatch(
      /:global\(\[class\*='filterBubble'\]\)\s*{[\s\S]*?background:\s*var\(--ce-status-success-text\)\s*!important;[\s\S]*?color:\s*var\(--ce-overlay-surface\)\s*!important;/,
    );
  });

  it('keeps listening mode from changing the pile card vertical layout', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.pileListeningLayout\s*{[\s\S]*?position:\s*relative;[\s\S]*?width:\s*100%;[\s\S]*?margin:\s*0;[\s\S]*?padding:\s*0;/,
    );
    expect(scss).toMatch(/\.pileListeningLayout \.pileWrapper\s*{[\s\S]*?width:\s*100%;[\s\S]*?margin-bottom:\s*38px;/);
    expect(scss).toMatch(
      /\.sessionListeningPanelAnchor\s*{[\s\S]*?position:\s*fixed;[\s\S]*?bottom:\s*clamp\(16px,\s*3vw,\s*36px\);[\s\S]*?pointer-events:\s*none;/,
    );
    expect(scss).toMatch(
      /\.sessionListeningPanel\s*{[\s\S]*?max-height:\s*calc\(100vh - 32px\);[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 1100px\)\s*{[\s\S]*?\.sessionListeningPanelAnchor\s*{[\s\S]*?position:\s*static;[\s\S]*?pointer-events:\s*auto;/,
    );
  });

  it('keeps listening mode record-first and uses copied HealthBot waveform controls while recording', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.sessionListeningRecordButton\s*{[\s\S]*?width:\s*132px;[\s\S]*?height:\s*132px;[\s\S]*?border-radius:\s*var\(--ce-radius-round\) !important;/,
    );
    expect(scss).toMatch(
      /\.sessionListeningActiveRecorder\s*{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*10px;[\s\S]*?background-color:\s*var\(--ce-document-surface\);/,
    );
    expect(scss).toMatch(
      /\.sessionListeningWaveformShell\s*{[\s\S]*?height:\s*80px;[\s\S]*?border:\s*2px inset var\(--ce-document-text-muted\);[\s\S]*?background-color:\s*var\(--ce-border-light\);/,
    );
    expect(scss).toMatch(/\.sessionListeningWaveformCanvas\s*{[\s\S]*?image-rendering:\s*pixelated;/);
    expect(scss).toMatch(
      /\.sessionListeningAudioButton\s*{[\s\S]*?width:\s*61px;[\s\S]*?height:\s*61px;[\s\S]*?background:\s*linear-gradient\(var\(--ce-document-border\),\s*var\(--ce-text-inverse\)\);/,
    );
    expect(scss).not.toMatch(/\.sessionListeningPrimary\s*{/);
    expect(scss).not.toMatch(/\.sessionListeningControls\s*{/);
  });

  it('keeps listening transcripts behind a compact button and clearable from an overlay control', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.sessionListeningTranscriptButton\s*{[\s\S]*?display:\s*inline-flex;[\s\S]*?border-radius:\s*var\(--ce-radius-pill\);[\s\S]*?cursor:\s*pointer;/,
    );
    expect(scss).toMatch(
      /\.sessionListeningTranscriptDetails\s*{[\s\S]*?background:\s*var\(--ce-text-inverse\);[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(/\.sessionListeningTranscriptShell\s*{[\s\S]*?position:\s*relative;/);
    expect(scss).toMatch(/\.sessionListeningTranscript\s*{[\s\S]*?padding:\s*10px 42px 10px 12px;/);
    expect(scss).toMatch(
      /\.sessionListeningClearTranscript\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*8px;[\s\S]*?right:\s*18px;/,
    );
  });

  it('presents pile multichoice options as large, discoverable horizontal-scroll cards', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.multichoiceQuestionContainer\s*{[\s\S]*?align-items:\s*flex-start;[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*hidden;[\s\S]*?scroll-snap-type:\s*x proximity;[\s\S]*?scrollbar-color:\s*var\(--ce-action-accent\) color-mix\(in srgb, var\(--ce-text-inverse\) 10%, transparent\);/,
    );
    expect(scss).toMatch(
      /\.multichoiceQuestionContainer #multiChoice\s*{[\s\S]*?font-size:\s*1rem;[\s\S]*?flex-direction:\s*column;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?align-content:\s*flex-start;[\s\S]*?align-items:\s*flex-start;[\s\S]*?width:\s*70%;[\s\S]*?max-width:\s*70%;/,
    );
    expect(scss).toMatch(
      /\.multichoiceQuestionContainer #multiChoice \.checkboxOptionText\s*{[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-height:\s*58px;[\s\S]*?padding:\s*14px 18px;[\s\S]*?font-size:\s*1rem !important;[\s\S]*?line-height:\s*1\.35;[\s\S]*?scroll-snap-align:\s*start;/,
    );
    expect(scss).toMatch(
      /\.multichoiceQuestionContainer #multiChoice \.checkboxOptionText\s*{[\s\S]*?&:focus-within\s*{[\s\S]*?outline:\s*3px solid var\(--ce-focus-ring\);/,
    );
  });

  it('keeps pile navigation arrows borderless with a visible keyboard focus ring', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(
      /\.pileNavArrow\s*{[\s\S]*?border:\s*0 !important;[\s\S]*?box-shadow:\s*none !important;[\s\S]*?&:focus-visible\s*{[\s\S]*?outline:\s*2px solid var\(--ce-focus-ring\);/,
    );
  });

  it('keeps single-question page chrome on the prior inherited font treatment', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.singleQuestionPage\s*{[\s\S]*?font-family:\s*inherit;/);
    expect(scss).toMatch(
      /\.singleQuestionJsonToggle\s*{[\s\S]*?font-family:\s*inherit;[\s\S]*?font-size:\s*0\.95rem;[\s\S]*?letter-spacing:\s*0\.06em;[\s\S]*?opacity:\s*0\.5;/,
    );
    expect(scss).toMatch(
      /\.singleQuestionJsonToggleQuestion\s*{[\s\S]*?color-mix\(in srgb, var\(--ce-compat-indigo\) 12%, transparent\)/,
    );
    expect(scss).toMatch(
      /\.singleQuestionJsonToggleResponse\s*{[\s\S]*?color-mix\(in srgb, var\(--ce-action-accent\) 10%, transparent\)/,
    );
    expect(scss).toMatch(/#answerSurveyButton\s*{[\s\S]*?font-family:\s*inherit;/);
    expect(scss).toMatch(/\.viewAddressHeadingSuffix\s*{[\s\S]*?margin-left:\s*0\.35rem;/);
  });

  it('keeps the pile hologram styled as a full-card takeover', () => {
    const scss = readSurveyToolScss();

    expect(scss).toMatch(/\.pileHologramToggle\s*{[\s\S]*?position:\s*absolute;[\s\S]*?opacity:\s*0\.5;/);
    expect(scss).toMatch(/\.pileHologramPanel\s*{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*400px;/);
  });
});
