import fs from 'fs';
import path from 'path';

describe('SBTsList module styles', () => {
  it('keeps the CommunityTab mini settings cog borderless and transparent', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'SBTsList.module.scss'), 'utf8');
    const baseMatch = scss.match(/\.miniSettingsButton\s*{([\s\S]*?)\n\s*}\n/);
    const activeMatch = scss.match(/\.miniSettingsButtonActive\s*{([\s\S]*?)\n\s*}\n/);

    expect(baseMatch?.[1] || '').toMatch(/border:\s*none;/);
    expect(baseMatch?.[1] || '').toMatch(/background:\s*transparent;/);
    expect(activeMatch?.[1] || '').toMatch(/border:\s*none;/);
    expect(activeMatch?.[1] || '').toMatch(/background:\s*transparent;/);
  });

  it('uses the muted OnePageSession-style section heading treatment', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'SBTsList.module.scss'), 'utf8');

    expect(scss).toMatch(
      /\.sectionTitle\s*{[\s\S]*?font-size:\s*2rem;[\s\S]*?font-family:\s*var\(--ce-font-body\);[\s\S]*?color:\s*color-mix\(in srgb,\s*var\(--ce-text-inverse\) 50%,\s*transparent\);/,
    );
    expect(scss).toMatch(
      /\.modalViewContainer\s*{[\s\S]*?\.sectionTitle\s*{[\s\S]*?color:\s*color-mix\(in srgb,\s*var\(--ce-text-inverse\) 50%,\s*transparent\)\s*!important;/,
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
    expect(scss).toMatch(
      /\.workerRouteToolbar\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;/,
    );
    expect(scss).toMatch(/\.workerRouteRefreshButton\s*{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/);
  });
});
