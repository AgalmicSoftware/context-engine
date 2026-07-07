const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '../..');

const EXPECTED_NON_PURE_TS_TRANSITIONAL_FILES = ['variables/appConfig.js'];

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim();

const normalizeForComparison = (source) => source.replace(/;\s*/g, '').replace(/\s+/g, ' ').trim();

const isJsToTsReexportBarrel = (filePath) => {
  const source = stripComments(fs.readFileSync(filePath, 'utf8'));
  if (!source) return false;

  const reexportPattern = /export\s+(?:\{[\s\S]*?\}|\*|\{\s*default\s*\})\s+from\s+['"]\.\/(.+?)\.(ts|tsx)['"]/g;
  const matches = [];
  let match = reexportPattern.exec(source);
  while (match) {
    matches.push(match[0]);
    match = reexportPattern.exec(source);
  }

  return matches.length > 0 && normalizeForComparison(source) === normalizeForComparison(matches.join(''));
};

const hasAdjacentTsReexport = (filePath) => /from ['"]\.\/[^'"]+\.tsx?['"]/.test(fs.readFileSync(filePath, 'utf8'));

const collectJsFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectJsFiles(filePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [filePath] : [];
  });

describe('transitional re-export inventory', () => {
  it('keeps pure js-to-ts compatibility barrels retired', () => {
    const discovered = collectJsFiles(SRC_ROOT)
      .filter(isJsToTsReexportBarrel)
      .map((filePath) => toPosixPath(path.relative(SRC_ROOT, filePath)))
      .sort();

    expect(discovered).toEqual([]);
  });

  it('keeps remaining explicit js-to-ts transitional files as documented non-pure exceptions', () => {
    const discovered = collectJsFiles(SRC_ROOT)
      .filter(hasAdjacentTsReexport)
      .map((filePath) => toPosixPath(path.relative(SRC_ROOT, filePath)))
      .sort();

    expect(discovered).toEqual(EXPECTED_NON_PURE_TS_TRANSITIONAL_FILES);
    expect(fs.readFileSync(path.join(SRC_ROOT, 'variables/appConfig.js'), 'utf8')).toContain('initializeRuntimeConfig');
  });
});
