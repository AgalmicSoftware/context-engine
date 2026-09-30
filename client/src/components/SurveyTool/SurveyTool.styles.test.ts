import fs from 'fs';
import path from 'path';

const readSurveyToolScss = () => fs.readFileSync(path.join(__dirname, 'SurveyTool.module.scss'), 'utf8');

describe('SurveyTool reduced-motion styles', () => {
  it('stops pile card switching motion', () => {
    expect(readSurveyToolScss()).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.pileCard,[\s\S]*?transition-duration: 0\.01ms !important;/,
    );
  });

  it('stops the pile submit rail border animation', () => {
    expect(readSurveyToolScss()).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.pileFooter\s+\.pileSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/,
    );
  });

  it('stops the header submit CTA border animation', () => {
    expect(readSurveyToolScss()).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\.headerSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/,
    );
  });
});
