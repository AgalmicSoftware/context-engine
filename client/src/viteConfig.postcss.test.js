const fs = require('fs');
const path = require('path');

describe('vite PostCSS compatibility', () => {
  it('does not run the legacy PurgeCSS config for Vite CSS modules', () => {
    const config = fs.readFileSync(path.join(__dirname, '..', 'vite.config.mjs'), 'utf8');

    expect(config).toMatch(/postcss:\s*{\s*plugins:\s*\[\]\s*}/);
    expect(config).toMatch(/PurgeCSS/);
    expect(config).toMatch(/strips CSS Module selectors/);
  });
});
