import fs from 'fs';
import path from 'path';

const stylesheet = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

describe('Modals module styles', () => {
  it('keeps every Minimal welcome-slide rule in one container block', () => {
    const minimalBlocks = stylesheet.match(/@container ce-theme style\(--ce-layout-profile: minimal-app\)/g) || [];

    expect(minimalBlocks).toHaveLength(1);
    expect(stylesheet).toMatch(
      /@container ce-theme style\(--ce-layout-profile: minimal-app\)\s*{[\s\S]*?\.welcomeSlideFooter\s*{[\s\S]*?\.welcomeSlideImageAudience\s*{\s*content:\s*url\('\.\.\/\.\.\/assets\/img\/seedsman_civic\.png'\);/,
    );
  });
});
