const fs = require('fs');
const path = require('path');

describe('vite PostCSS compatibility', () => {
  const clientRoot = path.join(__dirname, '..');

  it('keeps the retired PurgeCSS config out of the Vite CSS module path', () => {
    const config = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');
    const pkg = JSON.parse(fs.readFileSync(path.join(clientRoot, 'package.json'), 'utf8'));

    expect(config).toMatch(/postcss:\s*{\s*plugins:\s*\[\]\s*}/);
    expect(config).toMatch(/PurgeCSS/);
    expect(config).toMatch(/stripped CSS Module selectors/);
    expect(fs.existsSync(path.join(clientRoot, 'postcss.config.js'))).toBe(false);
    expect(pkg.dependencies['@fullhuman/postcss-purgecss']).toBeUndefined();
    expect(pkg.devDependencies['@fullhuman/postcss-purgecss']).toBeUndefined();
  });

  it('serves root posts Markdown as static assets', () => {
    const config = fs.readFileSync(path.join(clientRoot, 'vite.config.mjs'), 'utf8');

    expect(config).toMatch(/const postsDir = path\.resolve\(__dirname, '\.\.', 'posts'\);/);
    expect(config).toContain("'.md': 'text/markdown; charset=utf-8'");
    expect(config).toMatch(/name:\s*'ce-posts-assets-compatibility'/);
    expect(config).toMatch(/fs\.cpSync\(postsDir,[\s\S]*'posts'\)/);
  });
});
