import fs from 'node:fs';
import path from 'node:path';

describe('Docs page theme readability styles', () => {
  const scss = fs.readFileSync(path.join(__dirname, 'DocsPage.module.scss'), 'utf8');

  it('uses semantic surfaces instead of the legacy status-blue palette', () => {
    expect(scss).not.toContain('--retro-');
    expect(scss).not.toContain('var(--ce-status-info-text)');
    expect(scss).toContain('--docs-titlebar-bg: var(--ce-titlebar-bg);');
    expect(scss).toContain('--docs-document-text: var(--ce-document-text);');
    expect(scss).toContain('--docs-code-text: var(--ce-overlay-text);');
  });

  it('pairs title bars, document cards, and code readers with their matching text tokens', () => {
    expect(scss).toMatch(
      /\.docsHeader\s*\{[\s\S]*?background:\s*var\(--docs-titlebar-bg\);[\s\S]*?h1\s*\{[\s\S]*?color:\s*var\(--docs-titlebar-text\);[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--docs-titlebar-text\);/,
    );
    expect(scss).toMatch(
      /\.quickstartStep\s*\{[\s\S]*?background:\s*var\(--docs-document\);[\s\S]*?h2\s*\{[\s\S]*?color:\s*var\(--docs-document-text\);[\s\S]*?p\s*\{[\s\S]*?color:\s*var\(--docs-document-muted\);/,
    );
    expect(scss).toMatch(
      /\.contractCard\s*\{[\s\S]*?background:\s*var\(--docs-document\);[\s\S]*?color:\s*var\(--docs-document-text\);/,
    );
    expect(scss).toMatch(
      /\.codeBlock\s*\{[\s\S]*?background:\s*var\(--docs-code-bg\);[\s\S]*?color:\s*var\(--docs-code-text\);/,
    );
    expect(scss).toMatch(
      /\.promptBlock\s*\{[\s\S]*?background:\s*var\(--docs-code-bg\);[\s\S]*?color:\s*var\(--docs-code-text\);/,
    );
  });
});
