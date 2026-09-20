import fs from 'node:fs';
import path from 'node:path';

describe('SessionWizardNormalModeRail responsive styles', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SessionWizard.module.scss'), 'utf8');

  it('keeps setup step numbers readable on light and active theme surfaces', () => {
    expect(source).toMatch(
      /\.normalModeCardNumber\s*\{[\s\S]*?color:\s*color-mix\(in srgb, var\(--ce-control-text\) 60%, transparent\);/,
    );
    expect(source).toMatch(
      /\.normalModeCardActive\s*\{[\s\S]*?\.normalModeCardNumber\s*\{[\s\S]*?color:\s*color-mix\(in srgb, var\(--ce-control-text\) 72%, transparent\);/,
    );
  });

  it('keeps all setup steps in one compact row on mobile', () => {
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeRail\s*\{[\s\S]*?grid-template-columns:\s*repeat\(var\(--session-wizard-card-count, 4\), minmax\(0, 1fr\)\);[\s\S]*?gap:\s*6px;[\s\S]*?margin-bottom:\s*12px;/,
    );
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeCard\s*\{[\s\S]*?min-height:\s*78px;[\s\S]*?padding:\s*24px 6px 9px;/,
    );
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeCardCompact\s*\{[\s\S]*?padding:\s*9px 6px;/,
    );
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeCardTitle\s*\{[\s\S]*?font-size:\s*0\.78rem;[\s\S]*?line-height:\s*1\.12;/,
    );
    expect(source).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.normalModeCardSummary\s*\{[\s\S]*?display:\s*none;/);
  });
});
