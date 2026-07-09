import fs from 'fs';
import path from 'path';

describe('Modals contrast styles', () => {
  it('keeps the white email entry surface on dark text', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(/background:\s*var\(--ce-color-white\);\s*color:\s*#1f2733;/);
    expect(scss).not.toMatch(/background:\s*var\(--ce-color-white\);\s*color:\s*#ffffff;/);
  });

  it('keeps the intro image bottom-flush while preserving the centered titleless slide hooks', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.welcomeSlideMediaButton\[data-slide-layout='flushBottom'\]\s*\{\s*overflow:\s*hidden;[\s\S]*?align-items:\s*flex-end;/,
    );
    expect(scss).toMatch(
      /\.welcomeSlideEmbed \.welcomeSlideLayout \.welcomeSlideMediaButton\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?height:\s*auto\s*!important;[\s\S]*?align-items:\s*flex-end;/,
    );
    expect(scss).toMatch(
      /\.welcomeSlideImageIntro\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?max-height:\s*none\s*!important;[\s\S]*?object-fit:\s*contain;[\s\S]*?object-position:\s*left bottom;[\s\S]*?transform:\s*translateY\(2\.75%\);/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.welcomeSlideImageIntro\[data-slide-layout='flushBottom'\]\s*\{[\s\S]*?width:\s*75%;[\s\S]*?height:\s*100%;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*?\.welcomeSlideMediaButton\[data-slide-layout='flushBottom'\],\s*\.welcomeSlideMediaButtonCentered\[data-slide-layout='centered'\]\s*\{\s*overflow:\s*hidden;/,
    );
    expect(scss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*?\.welcomeSlideImageToolkit\[data-slide-layout='centered'\]\s*\{[\s\S]*?object-position:\s*center center;/,
    );
    expect(scss).toMatch(/\.welcomeSlideImageIntro\s*\{[\s\S]*?max-width:\s*95vw;/);
    expect(scss).toMatch(
      /\.welcomeSlideImageToolkit\s*\{[\s\S]*?max-height:\s*100%;[\s\S]*?max-width:\s*116%;[\s\S]*?align-self:\s*center;[\s\S]*?object-position:\s*center center;/,
    );
    expect(scss).not.toMatch(/\.welcomeSlideImageToolkit\s*\{[\s\S]*?transform:\s*translateX\(8%\);/);
    expect(scss).toMatch(
      /@media \(max-width:\s*768px\)\s*{[\s\S]*?\.welcomeSlideImageToolkit\[data-slide-layout='centered'\]\s*\{[\s\S]*?object-position:\s*center center;[\s\S]*?transform:\s*none;/,
    );
  });

  it('keeps the desktop right sidebar visible even when its inner content is empty', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.welcomeSlideSidebar\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*clamp\(280px,\s*31vw,\s*340px\);/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.welcomeSlideSidebar\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?min-height:\s*380px;/,
    );
  });

  it('uses the transparent goals image without restoring the black source rectangle', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.welcomeSlideImageGoals\s*\{[\s\S]*?max-height:\s*100%;[\s\S]*?mix-blend-mode:\s*screen\s*!important;[\s\S]*?opacity:\s*0\.86;/,
    );
    expect(scss).not.toMatch(/\.welcomeSlideImageGoals\s*\{[\s\S]*?filter:\s*invert\(1\);/);
  });

  it('blends the audience slide jpeg background in embedded welcome slides', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'Modals.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.welcomeSlideImageAudience\s*\{[\s\S]*?mix-blend-mode:\s*screen\s*!important;[\s\S]*?opacity:\s*1;[\s\S]*?filter:\s*brightness\(1\.08\) saturate\(1\.18\) contrast\(1\.08\);/,
    );
    expect(scss).not.toMatch(/\.welcomeSlideImageAudience\s*\{[\s\S]*?mask-image:/);
  });
});
