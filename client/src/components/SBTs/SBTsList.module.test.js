import fs from 'fs';
import path from 'path';

describe('SBTsList module styles', () => {
  it('uses muted page headings', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'SBTsList.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.sectionTitle\s*{[\s\S]*?font-size:\s*2rem;[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?color:\s*color-mix\(in srgb,\s*var\(--ce-text-inverse\) 50%,\s*transparent\);/,
    );
  });

  it('styles the featured SBT card container through a CSS-module class selector', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'SBTsList.module.scss'), 'utf8');

    expect(scss).toMatch(/\.featuredSBTsContainer\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
    expect(scss).not.toMatch(/#featuredSBTsContainer/);
  });

  it('keeps the wide Worker Groups toolbar aligned with borderless refresh', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'SBTsList.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.workerRouteSessionHero,\s*\.header \.createGroupButton\s*{[^}]*border:\s*1px solid color-mix\(in srgb, var\(--ce-color-white\) 50%, transparent\);/,
    );
    expect(scss).toMatch(/\.workerRouteToolbar\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/);
    expect(scss).toMatch(/\.workerRouteRefreshButton\s*{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/);
  });
});
