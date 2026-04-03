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
});
