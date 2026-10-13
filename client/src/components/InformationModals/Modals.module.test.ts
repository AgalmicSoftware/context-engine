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

  it('ships the Civic welcome artwork at about twice its displayed size', () => {
    // The slide shows it about 260-310 CSS px wide on common screens.
    const png = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'img', 'seedsman_civic.png'));

    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(640);
    expect(png.readUInt32BE(20)).toBeLessThanOrEqual(800);
    // Color type 6 is RGBA, which keeps the transparent background.
    expect(png[25]).toBe(6);
    expect(png.length).toBeLessThan(600 * 1024);
  });
});
