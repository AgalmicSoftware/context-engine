import fs from 'fs';
import path from 'path';

const stylesheet = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

describe('Modals module styles', () => {
  it('keeps every Minimal welcome-slide rule in one container block', () => {
    const minimalBlocks = stylesheet.match(/@container ce-theme style\(--ce-layout-profile: minimal-app\)/g) || [];

    expect(minimalBlocks).toHaveLength(1);
  });

  it('draws every slide picture as the same white dot art, inverted on the light canvas', () => {
    expect(stylesheet).toMatch(
      /\.welcomeSlideImageToolkit,\s*\.welcomeSlideImageGoals,\s*\.welcomeSlideImageAudience,\s*\.welcomeSlideImageMotivation,\s*\.welcomeSlideImageCollaborators\s*\{[^}]*max-width:\s*100%;[^}]*mix-blend-mode:\s*var\(--ce-welcome-artwork-blend-soft\)\s*!important;[^}]*opacity:\s*0\.75;/,
    );
    const minimal = stylesheet.slice(stylesheet.indexOf('@container ce-theme style(--ce-layout-profile: minimal-app)'));
    expect(minimal).toMatch(
      /\.welcomeSlideEmbed \.welcomeSlideLayout \.welcomeSlideImage\s*\{[^}]*opacity:\s*1;[^}]*filter:\s*invert\(1\) contrast\(1\.2\);[^}]*mix-blend-mode:\s*multiply\s*!important;/,
    );
    // No per-slide swaps or photo treatments: one file per slide serves every theme.
    expect(stylesheet).not.toMatch(/content:\s*url\(|blend-cutout|blend-intense|saturate\(/);
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
