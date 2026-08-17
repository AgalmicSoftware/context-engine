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
      /\.createSurveyButton,\s*#submitNewSurveyButton\s*{[\s\S]*?@include\s+finalSubmitCta\.final-submit-cta-shell\([\s\S]*?\);[\s\S]*?position:\s*relative;[\s\S]*?overflow:\s*hidden;/,
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
