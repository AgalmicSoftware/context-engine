import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const productionTrees = ['.', 'client', 'mcp', 'workers/sessionCorsWorker'];
const shippedBundles = [
  { tree: 'client', path: 'client/build/bundled-module-ids.json', format: 'vite' },
  { tree: 'mcp', path: 'dist/mcp.metafile.json', format: 'esbuild' },
  { tree: 'workers/sessionCorsWorker', path: 'dist/sessionCorsWorker.bundle.metafile.json', format: 'esbuild' },
];
const allowed = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Apache-2.0', 'MPL-2.0',
  'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0', 'Zlib', 'Python-2.0', 'CC-BY-4.0',
]);

// AND requires every license; OR needs one permitted alternative. Unknown
// atoms (including SEE LICENSE IN ...) never pass by themselves.
export const isAllowedLicense = (expression) => {
  if (typeof expression !== 'string' || !expression.trim()) return false;
  const tokens = expression.split(/(\(|\)|\bAND\b|\bOR\b)/).map((part) => part.trim()).filter(Boolean);
  let cursor = 0;
  const primary = () => {
    const token = tokens[cursor++];
    if (token === '(') {
      const value = disjunction();
      if (tokens[cursor++] !== ')') throw new Error('Unclosed license expression');
      return value;
    }
    if (!token || ['AND', 'OR', ')'].includes(token)) throw new Error('Invalid license expression');
    return allowed.has(token);
  };
  const conjunction = () => {
    let value = primary();
    while (tokens[cursor] === 'AND') { cursor += 1; value = primary() && value; }
    return value;
  };
  const disjunction = () => {
    let value = conjunction();
    while (tokens[cursor] === 'OR') { cursor += 1; value = conjunction() || value; }
    return value;
  };
  try {
    const result = disjunction();
    return cursor === tokens.length && result;
  } catch { return false; }
};

const bundledPackageFolders = (rootDir, bundle) => {
  const file = path.resolve(rootDir, bundle.path);
  if (!existsSync(file)) throw new Error(`Missing bundle inputs ${bundle.path}; run npm run license:check to build them.`);
  const metadata = JSON.parse(readFileSync(file, 'utf8'));
  const inputs = bundle.format === 'vite' ? metadata.moduleIds : metadata.inputs && Object.keys(metadata.inputs);
  if (!Array.isArray(inputs)) throw new Error(`Invalid bundle inputs: ${bundle.path}`);
  const folders = new Set();
  for (const input of inputs) {
    if (typeof input !== 'string') throw new Error(`Invalid module ID in ${bundle.path}`);
    if (!/(^|\/)node_modules\//.test(input)) continue;
    let directory = path.dirname(path.resolve(rootDir, input));
    let found = false;
    while (directory.includes(`${path.sep}node_modules${path.sep}`)) {
      const manifestPath = path.join(directory, 'package.json');
      const pkg = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
      if (pkg?.name && pkg?.version) {
        folders.add(realpathSync(directory));
        found = true;
        break;
      }
      directory = path.dirname(directory);
    }
    if (!found) throw new Error(`Missing installed package for bundled input: ${input}`);
  }
  return folders;
};

export const checkLicenses = ({ rootDir = projectRoot, trees = productionTrees, overrides, bundles = shippedBundles } = {}) => {
  const reviewed = overrides ?? JSON.parse(readFileSync(path.join(rootDir, 'scripts/license-overrides.json'), 'utf8'));
  const failures = [];
  const counts = [];
  const installed = new Set();
  const bundleFolders = new Map(trees.map((tree) => [tree, new Set()]));
  for (const bundle of bundles) {
    if (!bundleFolders.has(bundle.tree)) throw new Error(`Unknown bundle dependency tree: ${bundle.tree}`);
    for (const folder of bundledPackageFolders(rootDir, bundle)) bundleFolders.get(bundle.tree).add(folder);
  }
  for (const tree of trees) {
    const cwd = realpathSync(path.resolve(rootDir, tree));
    // npm's installed tree is authoritative: lockfiles omit many license fields.
    const output = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const folders = [...new Set([...output.trim().split(/\r?\n/).filter((folder) => folder && folder !== cwd).map((folder) => realpathSync(folder)), ...bundleFolders.get(tree)])];
    const all = execFileSync('npm', ['ls', '--all', '--parseable'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    for (const folder of all.trim().split(/\r?\n/).filter((folder) => folder && folder !== cwd)) {
      const pkg = JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8'));
      installed.add(`${pkg.name}@${pkg.version}`);
    }
    counts.push({ tree, packages: folders.length });
    for (const folder of folders) {
      const pkg = JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8'));
      const identity = `${pkg.name}@${pkg.version}`;
      const declared = typeof pkg.license === 'string' ? pkg.license : null;
      const override = reviewed[identity];
      if (override && (override.declaredLicense !== declared || !override.evidence?.source || !override.evidence?.reviewed || !override.evidence?.note)) {
        failures.push(`${tree}: ${identity} has stale or incomplete override evidence.`);
        continue;
      }
      const license = override?.license ?? declared;
      if (!isAllowedLicense(license)) failures.push(`${tree}: ${identity} has ${license || 'no license metadata'}; review its license before allowing it.`);
    }
  }
  for (const identity of Object.keys(reviewed)) {
    if (!installed.has(identity)) failures.push(`${identity} override is stale: this version is no longer installed.`);
  }
  return { counts, failures, checked: counts.reduce((sum, entry) => sum + entry.packages, 0) };
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkLicenses();
    for (const failure of result.failures) console.error(failure);
    console.log(`Dependency licenses: ${result.checked} production and bundled packages across ${result.counts.length} trees; ${result.failures.length} failures.`);
    process.exitCode = result.failures.length ? 1 : 0;
  } catch (error) {
    console.error(`Dependency license check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
