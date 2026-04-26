import fs from 'fs';
import path from 'path';

describe('CommunityTab module styles', () => {
  it('stacks mobile sections as statistics, beeswarm, then leaderboard', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.rightSection\s*{[\s\S]*?order:\s*1;[\s\S]*?}/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.statsSection\s*{[\s\S]*?order:\s*1;[\s\S]*?}/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.beeswarmSection\s*{[\s\S]*?order:\s*2;[\s\S]*?}/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.leaderboardSection\s*{[\s\S]*?order:\s*2;[\s\S]*?border-top:\s*1px solid var\(--ce-color-border-light\);[\s\S]*?border-bottom:\s*none;[\s\S]*?}/);
  });

  it('keeps the modal viewport-bounded and scrollable without losing centered margins on narrow screens', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'CommunityTab.module.scss'), 'utf8');

    expect(scss).toMatch(/\.modal\s*{[\s\S]*?:global\(\.modal-content\)\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?max-height:\s*calc\(100vh - 2rem\);[\s\S]*?overflow:\s*hidden;/);
    expect(scss).toMatch(/\.modal\s*{[\s\S]*?:global\(\.modal-body\)\s*{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/);
    expect(scss).toMatch(/@media \(max-width: 768px\)\s*{[\s\S]*?\.modal\s*{[\s\S]*?width:\s*calc\(100vw - 1\.5rem\);[\s\S]*?max-width:\s*calc\(100vw - 1\.5rem\);[\s\S]*?margin:\s*0\.75rem auto;/);
  });
});
