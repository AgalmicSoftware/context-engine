import { build } from 'esbuild';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'mcp/dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['mcp/bin/context-engine-mcp.mjs'],
  outfile: join(dist, 'contextengine.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  legalComments: 'eof',
  metafile: true,
  banner: { js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);" },
});
// Keep build metadata outside the npm package, for the shipped-code license gate.
await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/mcp.metafile.json'), `${JSON.stringify(result.metafile, null, 2)}\n`);

const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  const absolute = resolve(root, input);
  if (!absolute.includes('/node_modules/')) continue;
  let directory = dirname(absolute);
  while (directory.includes('/node_modules/')) {
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (manifest?.name && manifest?.version) {
      packages.set(directory, manifest);
      break;
    }
    directory = dirname(directory);
  }
}

const notices = [];
for (const [directory, manifest] of packages) {
  const licenseFiles = (await readdir(directory)).filter((name) => /^(licen[cs]e|copying)([.-]|$)/i.test(name)).sort();
  const texts = await Promise.all(licenseFiles.map(async (name) => `${name}\n${await readFile(join(directory, name), 'utf8')}`));
  if (!texts.length) {
    const readme = await readFile(join(directory, 'README.md'), 'utf8');
    const embedded = readme.match(/^#+ LICENSE\s*\n([\s\S]*)/im)?.[1]?.split(/^\[\d+\]:/m)[0];
    if (embedded?.includes('Permission is hereby granted') && embedded.includes('USE OR OTHER DEALINGS IN THE SOFTWARE.')) {
      texts.push(`README.md (license section)\n${embedded.trim()}`);
    } else if (manifest.name === '@ethersproject/logger' && manifest.version === '5.7.0' && manifest.license === 'MIT') {
      // This monorepo package omits the full notice; ethers ships the shared MIT license.
      texts.push(`ethers/LICENSE.md\n${await readFile(join(root, 'mcp/node_modules/ethers/LICENSE.md'), 'utf8')}`);
    }
  }
  if (!texts.length) throw new Error(`Missing license text for ${manifest.name}@${manifest.version}`);
  const license = manifest.license || manifest.licenses?.map((entry) => entry.type).join(', ');
  if (!license) throw new Error(`Missing license identifier for ${manifest.name}@${manifest.version}`);
  notices.push(`${manifest.name}@${manifest.version}\nLicense: ${typeof license === 'string' ? license : license.type}\n\n${texts.join('\n\n')}`);
}
await writeFile(join(dist, 'THIRD_PARTY_LICENSES.txt'), notices.sort().join('\n\n------------------------------------------------------------\n\n') + '\n');
await chmod(join(dist, 'contextengine.mjs'), 0o755);
console.error(`MCP bundle written with ${notices.length} third-party license notices.`);
