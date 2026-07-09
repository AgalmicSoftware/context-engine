import fs from 'fs';
import path from 'path';

describe('RightSide desktop shell styles', () => {
  it('keeps the home route in a desktop row and reserves width for the right shell', () => {
    const mainSiteScss = fs.readFileSync(path.join(__dirname, '../MainSite/AppShell.module.scss'), 'utf8');
    const mainContentScss = fs.readFileSync(path.join(__dirname, '../MainContent/MainContent.module.scss'), 'utf8');

    expect(mainSiteScss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.main\s*{[\s\S]*?flex-direction:\s*row;[\s\S]*?align-items:\s*stretch;/,
    );
    expect(mainContentScss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.mainAreaTabsAlt\s*{[\s\S]*?width:\s*75%;[\s\S]*?margin-right:\s*2%;/,
    );
  });

  it('shows the empty right shell only on desktop breakpoints', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'RightSide.module.scss'), 'utf8');

    expect(scss).toMatch(/\.rightSideContainer\s*{\s*display:\s*none;\s*}/);
    expect(scss).toMatch(
      /@media \(min-width:\s*769px\) and \(max-width:\s*1366px\)\s*{[\s\S]*?\.rightSideContainer\s*{[\s\S]*?flex:\s*0 0 23%;[\s\S]*?display:\s*flex;/,
    );
    expect(scss).toMatch(
      /@media \(min-width:\s*1367px\)\s*{[\s\S]*?\.rightSideContainer\s*{[\s\S]*?flex:\s*0 0 23%;[\s\S]*?display:\s*flex;/,
    );
    expect(scss).toMatch(/\.rightSideCard\s*{[\s\S]*?background:\s*var\(--ce-color-bg\);[\s\S]*?box-shadow:/);
  });
});
