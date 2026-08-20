import fs from 'node:fs';
import path from 'node:path';

describe('SessionWizardNormalModeRail responsive styles', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SessionWizard.module.scss'), 'utf8');

  it('keeps all setup steps in one compact row on mobile', () => {
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeRail\s*\{[\s\S]*?grid-template-columns:\s*repeat\(var\(--session-wizard-card-count, 4\), minmax\(0, 1fr\)\);[\s\S]*?gap:\s*6px;[\s\S]*?margin-bottom:\s*12px;/,
    );
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeCard\s*\{[\s\S]*?min-height:\s*78px;[\s\S]*?padding:\s*26px 8px 10px;/,
    );
    expect(source).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.normalModeCardTitle\s*\{[\s\S]*?font-size:\s*0\.9rem;[\s\S]*?line-height:\s*1\.15;/,
    );
    expect(source).toMatch(/@media \(max-width: 720px\)[\s\S]*?\.normalModeCardSummary\s*\{[\s\S]*?display:\s*none;/);
  });
});
