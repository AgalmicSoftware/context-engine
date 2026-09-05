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

  it('keeps contract-card links and labels readable on the document surface', () => {
    expect(scss).toMatch(
      /\.contractHeader\s*\{[\s\S]*?a\s*\{[\s\S]*?color:\s*var\(--docs-document-text\);[\s\S]*?text-decoration:\s*underline;[\s\S]*?text-decoration-color:\s*var\(--docs-link\);/,
    );
    expect(scss).toMatch(/\.testnetLabel\s*\{[\s\S]*?color:\s*var\(--docs-document-text\);/);
    expect(scss).toMatch(/\.contractToggleIcon\s*\{[\s\S]*?color:\s*var\(--docs-document-text\);/);
  });

  it('keeps the Docs GitHub action beside the title with a visible focus treatment', () => {
    expect(scss).toMatch(
      /\.docsHeaderTitleRow\s*\{[\s\S]*?display:\s*flex;[\s\S]*?align-items:\s*center;[\s\S]*?gap:\s*14px;/,
    );
    expect(scss).toMatch(
      /\.docsGithubLink\s*\{[\s\S]*?color:\s*var\(--docs-titlebar-text\);[\s\S]*?\.docsGithubLink:focus-visible\s*\{[\s\S]*?outline:\s*3px solid var\(--ce-focus-ring\);/,
    );
  });

  it('frames the session selector, context, and Smart Contracts as one bottom explorer', () => {
    expect(scss).toMatch(
      /\.contractSessionExplorer\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*14px;[\s\S]*?padding:\s*18px;[\s\S]*?border:\s*var\(--ce-border-control-width\) solid var\(--docs-border\);[\s\S]*?background:\s*var\(--docs-surface-alt\);/,
    );
    expect(scss).not.toContain('.advancedExternalNotice');
  });
});
