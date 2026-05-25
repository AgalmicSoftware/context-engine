import fs from 'fs';
import path from 'path';

describe('SBTsPage module styles', () => {
  it('uses class selectors for CSS-module exports consumed by SBTsPage', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'SBTsPage.module.scss'), 'utf8');

    expect(scss).toMatch(/\.showResultsButton\s*{/);
    expect(scss).toMatch(/\.buttonRow\s*{/);
    expect(scss).toMatch(/\.loadingIcon\s*{/);
    expect(scss).not.toMatch(/#(?:showResultsButton|buttonRow|loadingIcon)\b/);
  });
});
