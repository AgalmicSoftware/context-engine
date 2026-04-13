import fs from 'fs';
import path from 'path';

describe('CreateSurvey.module.scss final submit CTA guards', () => {
  it('uses the shared final submit shell while keeping progress and submit states intact', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateSurvey.module.scss'), 'utf8');

    expect(scss).toMatch(/@use\s+"scss\/finalSubmitCta"\s+as\s+finalSubmitCta;/);
    expect(scss).toMatch(/\.createSurveyButton,\s*#submitNewSurveyButton\s*{[\s\S]*?@include\s+finalSubmitCta\.final-submit-cta-shell\([\s\S]*?\);[\s\S]*?position:\s*relative;[\s\S]*?overflow:\s*hidden;/);
    expect(scss).toMatch(/\.buttonProgressFill\s*{[\s\S]*?position:\s*absolute;[\s\S]*?width:\s*0%;/);
    expect(scss).toMatch(/\.submittingButton\s*{[\s\S]*?border-color:\s*#0d6efd !important;/);
    expect(scss).toMatch(/\.errorButton\s*{[\s\S]*?background-color:\s*#dc3545 !important;/);
  });

  it('keeps the final submit content wrapper uppercase and centered', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CreateSurvey.module.scss'), 'utf8');

    expect(scss).toMatch(/\.buttonContent\s*{[\s\S]*?@include\s+finalSubmitCta\.final-submit-cta-content\(\$gap:\s*10px\);[\s\S]*?text-transform:\s*uppercase;/);
  });
});
