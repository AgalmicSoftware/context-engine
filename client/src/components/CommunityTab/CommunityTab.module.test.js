import fs from 'fs';
import path from 'path';
import * as sass from 'sass';

describe('CommunityTab module styles', () => {
  it('gives the portal Users selector an opaque theme control surface and readable text', () => {
    const css = sass.compile(path.join(__dirname, 'CommunityTab.module.scss')).css;
    const controlRule = css.match(/([^{}]+\.usersSessionSelector select)\s*\{([^}]+)\}/);
    const selector = controlRule?.[2] || '';
    const controlSelector = controlRule?.[1].trim() || '';
    expect(controlSelector).toBe('.modal .modalBody .usersSessionSelector select');
    // The actual global recipe sets --ce-text on all themed selects. The
    // portal-local control must outrank its root pseudo-class and attribute.
    const recipes = sass.compile(path.join(__dirname, '../../scss/themes/_recipes.scss')).css;
    const recipeSelector = ':root[data-ce-theme] select';
    expect(recipes).toContain(recipeSelector);
    const classSpecificity = (value) => (value.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) || []).length;
    expect(classSpecificity(controlSelector)).toBeGreaterThan(classSpecificity(recipeSelector));
    expect(selector).toContain('color: var(--ce-control-text)');
    expect(selector).toContain('background: var(--ce-control-face)');
    expect(selector).toContain('border-color: var(--ce-input-border)');
    expect(css).toMatch(/\.modal \.modalBody \.usersSessionSelector > span\s*\{[^}]*color: var\(--ce-panel-text\)/);
    expect(css).toMatch(/\.usersSessionSelector option\s*\{[^}]*color: var\(--ce-control-text\)/);
    expect(css).toMatch(/\.usersSessionSelector option\s*\{[^}]*background: var\(--ce-control-face\)/);
  });

  it('stacks mobile sections as statistics, beeswarm, then leaderboard', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.sessionContent\s*{[\s\S]*?flex-direction:\s*column;[\s\S]*?}/,
    );
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.statsSection\s*{[\s\S]*?order:\s*1;[\s\S]*?}/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.beeswarmSection\s*{[\s\S]*?order:\s*1;[\s\S]*?}/);
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.leaderboardSection\s*{[\s\S]*?order:\s*2;[\s\S]*?border-top:\s*1px solid var\(--ce-color-border-light\);[\s\S]*?border-bottom:\s*none;[\s\S]*?}/,
    );
  });

  it('keeps the modal viewport-bounded and scrollable without losing centered margins on narrow screens', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.modal\s*{[\s\S]*?:global\(\.modal-content\)\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?max-height:\s*calc\(100vh - 2rem\);[\s\S]*?overflow:\s*hidden;/,
    );
    expect(scss).toMatch(
      /\.modal\s*{[\s\S]*?:global\(\.modal-body\)\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
    );
    expect(scss).toMatch(
      /@media \(max-width: 768px\)\s*{[\s\S]*?\.modal\s*{[\s\S]*?width:\s*calc\(100vw - 1\.5rem\);[\s\S]*?max-width:\s*calc\(100vw - 1\.5rem\);[\s\S]*?margin:\s*0\.75rem auto;/,
    );
  });

  it('anchors the community groups modal close button in the top-right corner', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.modal\s*{[\s\S]*?\.modalHeader\s*{[\s\S]*?position:\s*relative;[\s\S]*?padding:\s*20px 4\.25rem 20px 30px;/,
    );
    expect(scss).toMatch(
      /:global\(\.close\),[\s\S]*?:global\(\.btn-close\)\s*{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*1rem;[\s\S]*?right:\s*1rem;/,
    );
    expect(scss).toMatch(
      /:global\(\.close\),[\s\S]*?:global\(\.btn-close\)\s*{[\s\S]*?opacity:\s*0\.5;[\s\S]*?background:\s*transparent;/,
    );
    expect(scss).not.toMatch(/:global\(\.modal-header\)\s*{[\s\S]*?:global\(\.close\)/);
  });

  it('uses the classic split-pane participant and chart area', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toContain('@container ce-theme style(--ce-layout-profile: desktop-window)');
    expect(scss).not.toContain('data-ce-theme');
    expect(scss).toMatch(/\.communityTab \.leaderboardSection\s*{[\s\S]*?flex:\s*0 0 28%;/);
    expect(scss).toMatch(/\.communityTab \.statsGrid\s*{[\s\S]*?grid-template-columns:\s*repeat\(5,/);
    expect(scss).toMatch(/\.communityTab \.beeswarmSection\s*{[\s\S]*?background:\s*var\(--ce-data-viz-surface\);/);
    expect(scss).toMatch(
      /\.communityTab \.beeswarmPlot\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?justify-content:\s*center;/,
    );
  });

  it('keeps classic participant addresses readable on light rows', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.communityTab \.leaderboardItem\s*{[\s\S]*?background:\s*var\(--ce-surface-light\);[\s\S]*?color:\s*var\(--ce-document-text\);/,
    );
    expect(scss).toMatch(
      /\.communityTab \.leaderboardItem \.name\s*{[\s\S]*?color:\s*var\(--ce-document-text\) !important;[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.communityTab \.leaderboardItem \.name a\s*{[\s\S]*?color:\s*var\(--ce-document-text\) !important;[\s\S]*?opacity:\s*1;/,
    );
    expect(scss).toMatch(
      /\.communityTab \.leaderboardItem:hover\s*{[\s\S]*?background:\s*var\(--ce-surface-alt\);[\s\S]*?color:\s*var\(--ce-document-text\);/,
    );
  });

  it('keeps the default stats and participant surfaces transparent', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(/^ {2}\.leaderboardSection \{[\s\S]*?^ {4}background:\s*transparent;[\s\S]*?^ {2}\}/m);
    expect(scss).toMatch(/^ {2}\.statsSection \{[\s\S]*?^ {4}background:\s*transparent;[\s\S]*?^ {2}\}/m);
    expect(scss).toMatch(/^ {2}\.leaderboardItem \{[\s\S]*?^ {4}background:\s*transparent;[\s\S]*?^ {2}\}/m);
  });

  it('marks active session filters with a data attribute instead of a toggle-button state', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.sessionFilterToggle\[data-active='true'\]\s*{[\s\S]*?background:\s*var\(--ce-selection-bg\);/,
    );
    expect(scss).not.toContain('aria-pressed');
  });
});
