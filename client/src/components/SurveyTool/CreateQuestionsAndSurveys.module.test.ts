import fs from 'fs';
import path from 'path';
import { normalizeScssContract } from 'testUtils/scssContractAssertions';

describe('CreateQuestionsAndSurveys.module.scss final submit CTA guards', () => {
  it('keeps the authoring mode switch readable in every app theme', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateQuestionsAndSurveys.module.scss'), 'utf8');

    expect(scss).toMatch(/\.modeSwitchButton\s*{[\s\S]*?opacity:\s*1;/);
    expect(scss).toMatch(/\.modeSwitchButton\s*{[\s\S]*?background:\s*var\(--ce-authoring-control-bg\);/);
    expect(scss).toMatch(/\.modeSwitchButton\s*{[\s\S]*?color:\s*var\(--ce-authoring-control-text\);/);
  });

  it('uses the shared final submit shell while keeping progress and submit states intact', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateQuestionsAndSurveys.module.scss'), 'utf8');
    const normalizedScss = normalizeScssContract(scss);

    expect(normalizedScss).toMatch(/@use\s+'scss\/finalSubmitCta'\s+as\s+finalSubmitCta;/);
    expect(scss).toMatch(
      /\.createSurveyButton\s*{[\s\S]*?@include\s+finalSubmitCta\.final-submit-cta-shell\([\s\S]*?\);[\s\S]*?position:\s*relative;[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(/\.buttonProgressFill\s*{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*0%;/);
    expect(scss).toMatch(/\.submittingButton\s*{[\s\S]*?border-color:\s*var\(--ce-status-info\) !important;/);
    expect(scss).toMatch(/\.errorButton\s*{[\s\S]*?background-color:\s*var\(--ce-status-danger\) !important;/);
  });

  it('keeps the final submit content wrapper uppercase and centered', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateQuestionsAndSurveys.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.buttonContent\s*{[\s\S]*?@include\s+finalSubmitCta\.final-submit-cta-content\(\$gap:\s*10px\);[\s\S]*?text-transform:\s*uppercase;/,
    );
  });

  it('keeps rating and freeform previews visible through authoring theme tokens', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateQuestionsAndSurveys.module.scss'), 'utf8');

    expect(scss).toMatch(/\.ratingPreview\s*{[\s\S]*?color:\s*var\(--ce-authoring-control-text\);/);
    expect(scss).toMatch(/\.ratingPreviewWrap\s*{[\s\S]*?background:\s*var\(--ce-authoring-input-bg\);/);
    expect(scss).toMatch(/\.freeformPreview\s*{[\s\S]*?color:\s*var\(--ce-authoring-input-placeholder\);/);
    expect(scss).toMatch(/\.freeformPreview\s*{[\s\S]*?opacity:\s*1;/);
  });
});

describe('CreateQuestionsAndSurveys.module.scss interview suggestion review guards', () => {
  it('keeps review cards compact and lets the add-tag field expand only after activation', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateQuestionsAndSurveys.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.interviewQuestionReview\.createSurveyContainer\s*{[\s\S]*?\.questionContainer\s*{[\s\S]*?padding:\s*14px\s+16px\s+16px;/,
    );
    expect(scss).toContain('.revealTagInputButton');
    expect(scss).not.toMatch(/:focus-within\s+\.revealTagInputButton/);
    expect(scss).toContain('.interviewQuestionPromptActions');
  });

  // The card's plain button look stops at its own buttons, at its old weight, so the remove × stays red and
  // an answer preview or option editor inside the card keeps its own look.
  it("styles only the card's own buttons, without outranking their classes", () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateQuestionsAndSurveys.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.interviewQuestionPrompt\s*{[\s\S]*?> button,\s*:where\(\.interviewQuestionPromptActions\) button\s*{\s*border: 0;/,
    );
    expect(scss).toMatch(
      /\.interviewQuestionPromptActions \.removeQuestionButton\s*{\s*color: var\(--ce-status-error\);/,
    );
    // Its own stacking context keeps the slider's raised handle under the pinned Submit bar and the drafts cue.
    expect(scss).toMatch(
      /\.interviewQuestionPreview\s*{\s*min-width: 0;\s*margin: 0;\s*padding: 0;\s*border: 0;\s*isolation: isolate;/,
    );
  });
});
