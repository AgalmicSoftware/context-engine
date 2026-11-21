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

  it('lets a phone slide fill a fixed-height pane: the picture takes the room the copy leaves', () => {
    const phone = stylesheet.slice(stylesheet.indexOf('// Phone slides give the copy the full pane width'));
    const block = phone.slice(0, phone.indexOf('\n@container ce-theme style(--ce-layout-profile: minimal-app)'));
    const [plain, fixed] = block.split('@container ce-theme style(--ce-welcome-slide-mode: fixed-window)');

    expect(plain).toMatch(/@media \(max-width: 465px\)/);
    // A size container needs the pane's set height, so it stays inside the fixed-height rules.
    expect(plain).not.toMatch(/container-type|cqh/);
    expect(fixed).toMatch(/\.welcomeSlideLayout\s*{[^}]*container-type:\s*size;/);
    expect(fixed).toMatch(/flex:\s*1 1 clamp\([^;]*;\s*height:\s*auto !important;/);
    // The copy never drops under the reader's own text size, and grows only as far as the pane's height allows.
    expect(fixed).toMatch(/font-size:\s*clamp\(1rem, min\([\d.]+cqh, [^)]*\), 1\.5rem\);/);
  });
});
