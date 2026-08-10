import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(repoRoot, 'client', 'src');
const baselinePath = path.resolve(sourceRoot, 'scss', 'themes', 'color-literal-baseline.json');
const approvedPaletteRoots = [
  path.resolve(sourceRoot, 'scss', 'themes'),
  path.resolve(sourceRoot, 'scss', 'session-color-schemes'),
];
const colorLiteralPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi;

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return entry.isFile() ? [absolutePath] : [];
  });

export const collectThemeColorLiteralCounts = () =>
  Object.fromEntries(
    walk(sourceRoot)
      .filter((filename) => /\.(?:css|scss)$/i.test(filename))
      .filter((filename) => !approvedPaletteRoots.some((root) => filename.startsWith(root + path.sep)))
      .map((filename) => {
        const relativePath = path.relative(repoRoot, filename).split(path.sep).join('/');
        const matches = fs.readFileSync(filename, 'utf8').match(colorLiteralPattern) || [];
        return [relativePath, matches.length];
      })
      .filter(([, count]) => count > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const current = collectThemeColorLiteralCounts();
if (process.argv.includes('--json')) {
  process.stdout.write(
    `${JSON.stringify(
      {
        version: 1,
        scope:
          'client/src/**/*.{css,scss}, excluding approved palette owners client/src/scss/themes and client/src/scss/session-color-schemes',
        counts: current,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const increases = Object.entries(current).filter(([filename, count]) => {
  const allowed = baseline.counts?.[filename];
  return typeof allowed !== 'number' || count > allowed;
});

if (increases.length) {
  const details = increases
    .map(([filename, count]) => `- ${filename}: ${count} (baseline ${baseline.counts?.[filename] ?? 0})`)
    .join('\n');
  throw new Error(
    `Theme color-literal ratchet increased. Use semantic --ce-* tokens or document and intentionally update the baseline:\n${details}`,
  );
}

const currentTotal = Object.values(current).reduce((sum, count) => sum + count, 0);
const baselineTotal = Object.values(baseline.counts || {}).reduce((sum, count) => sum + count, 0);
process.stdout.write(`Theme color-literal ratchet passed (${currentTotal}/${baselineTotal}).\n`);
