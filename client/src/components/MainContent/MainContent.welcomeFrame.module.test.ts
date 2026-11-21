import fs from 'node:fs';
import path from 'node:path';

describe("the Welcome slides' frame on desktop widths", () => {
  const scss = fs.readFileSync(path.join(__dirname, 'MainContent.module.scss'), 'utf8');
  // Where the band that sizes the frame starts: a width has several blocks, and one of them sets the heights.
  const bandStart = (media: string) => {
    for (let at = scss.indexOf(media); at > -1; at = scss.indexOf(media, at + 1)) {
      const end = scss.indexOf('\n}\n', at);
      if (scss.slice(at, end).includes('--ce-main-welcome-frame-height:')) return at;
    }
    return -1;
  };
  const block = (media: string) => {
    const start = bandStart(media);
    expect(start).toBeGreaterThan(-1);
    return scss.slice(start, scss.indexOf('\n}\n', start));
  };
  const bands = ['@media (min-width: 769px) and (max-width: 1366px) {', '@media (min-width: 1367px) {'];

  it.each(bands)('gives %s a filling height that follows the window and never shrinks to a thumbnail', (media) => {
    const fill = block(media).match(/--ce-welcome-fill-frame-height:\s*([^;]+);/)?.[1] || '';
    const [, floor, middle, ceiling] = fill.match(/^clamp\((\d+)px,\s*(.+),\s*(\d+)px\)$/) || [];
    // A floor: the compact height has none, so a short window left a picture under 200px tall.
    expect(Number(floor)).toBeGreaterThanOrEqual(420);
    // The window's own height, less the page header and tabs above the slide.
    expect(middle).toMatch(/^calc\(100dvh - \d+px\)$/);
    expect(Number(middle.match(/(\d+)px/)?.[1])).toBeLessThanOrEqual(320);
    expect(Number(ceiling)).toBeGreaterThanOrEqual(600);
    // The compact height stays for Classic 95, whose page must fit one window.
    expect(block(media)).toMatch(/--ce-main-welcome-frame-height:\s*max\(0px,/);
  });

  it('uses the filling height wherever a theme does not set its own frame', () => {
    expect(scss).toContain('height: var(--ce-welcome-fill-frame-height, var(--ce-main-welcome-frame-height, 100%));');
    expect(scss).toMatch(
      /--ce-welcome-frame-height:\s*var\(\s*--ce-welcome-fill-frame-height,\s*var\(--ce-main-welcome-frame-height, clamp\(525px, 118vw, 600px\)\)\s*\);/,
    );
  });

  it('leaves Classic 95 on the compact frame and the dark theme on its own wide one', () => {
    // Classic 95 reads the compact height only, capped at 500px.
    expect(scss).toContain(
      '--ce-welcome-frame-height: min(500px, var(--ce-main-welcome-frame-height, clamp(410px, 52dvh, 500px)));',
    );
    // The dark theme's wide frame sets both to its own height, so the filling height does not replace it.
    expect(scss).toMatch(
      /--ce-main-welcome-frame-height:\s*max\(540px, calc\(100dvh - 330px\)\);[\s\S]{0,160}--ce-welcome-fill-frame-height:\s*max\(540px, calc\(100dvh - 330px\)\);/,
    );
  });

  it('leaves phones and medium screens on their own fixed frame', () => {
    // Up to 768px no band sets either height, so the fixed tall frame applies: the medium-screen baseline.
    const before = scss.slice(0, bandStart(bands[0]));
    expect(before).not.toContain('--ce-main-welcome-frame-height:');
    expect(before).not.toContain('--ce-welcome-fill-frame-height:');
  });
});
