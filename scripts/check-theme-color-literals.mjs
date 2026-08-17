import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(repoRoot, 'client', 'src');
const baselinePath = path.resolve(sourceRoot, 'scss', 'themes', 'color-literal-baseline.json');
const approvedLiteralFiles = [
  path.resolve(sourceRoot, 'scss', 'themes', '_context-engine.scss'),
  path.resolve(sourceRoot, 'scss', 'themes', '_classic-95.scss'),
  path.resolve(sourceRoot, 'scss', 'session-color-schemes', '_schemes.scss'),
  path.resolve(sourceRoot, 'utilities', 'sessionResultsExport', 'sessionResultsExport.ts'),
  path.resolve(sourceRoot, 'utilities', 'ui', 'fixedMediaColors.ts'),
  path.resolve(sourceRoot, 'utilities', 'ui', 'blockieAvatars.ts'),
];
const colorLiteralPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/gi;
const namedColorPattern =
  /(?<![-\w])(?:color|background(?:-?color)?|border(?:-?color)?|fill|stroke|shadow|stopColor|floodColor|bgColor|fgColor|fillStyle)\s*[:=]\s*[{'"]*(?:white|black|silver|gray|grey|maroon|red|purple|fuchsia|magenta|green|lime|olive|yellow|navy|blue|teal|aqua|cyan|orange|pink|gold|goldenrod|lightgreen)\b/gi;

const walk = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return entry.isFile() ? [absolutePath] : [];
  });

export const collectThemeColorLiteralCounts = () =>
  Object.fromEntries(
    walk(sourceRoot)
      .filter((filename) => /\.(?:css|scss|js|jsx|ts|tsx)$/i.test(filename))
      .filter((filename) => !/\.(?:test|spec)\.[^.]+$/i.test(filename))
      .filter((filename) => !approvedLiteralFiles.includes(filename))
      .map((filename) => {
        const relativePath = path.relative(repoRoot, filename).split(path.sep).join('/');
        const source = fs.readFileSync(filename, 'utf8');
        const literalMatches = source.match(colorLiteralPattern) || [];
        const namedMatches = source.match(namedColorPattern) || [];
        return [relativePath, literalMatches.length + namedMatches.length];
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
        scope: 'themeable client/src presentation sources, excluding the documented palette/export/fixed-media owners',
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
    `Theme color-literal ratchet increased. Use semantic --ce-* tokens or add a narrowly documented fixed-output owner:\n${details}`,
  );
}

const currentTotal = Object.values(current).reduce((sum, count) => sum + count, 0);
const baselineTotal = Object.values(baseline.counts || {}).reduce((sum, count) => sum + count, 0);
process.stdout.write(`Theme color-literal ratchet passed (${currentTotal}/${baselineTotal}).\n`);
