import fs from 'fs';
import path from 'path';

describe('AppShell module styles', () => {
  it('styles the home route root through a CSS-module class selector', () => {
    const scss = fs.readFileSync(path.join(__dirname, 'AppShell.module.scss'), 'utf8');

    expect(scss).toMatch(/\.main\s*{[\s\S]*?display:\s*flex;/);
    expect(scss).not.toMatch(/#main\b/);
  });
});
