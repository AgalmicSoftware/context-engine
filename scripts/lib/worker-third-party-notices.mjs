import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

// Follow the installed package owning each esbuild input, including nested
// dependencies and package subdirectories with type-only package.json files.
export const buildWorkerThirdPartyNotices = ({ rootDir, metafile }) => {
  if (!metafile?.inputs) throw new Error('Worker bundle metafile is required for third-party notices.');
  const packages = new Map();
  for (const input of Object.keys(metafile.inputs)) {
    let directory = dirname(resolve(rootDir, input));
    if (!directory.includes('/node_modules/')) continue;
    let found = false;
    while (directory.includes('/node_modules/')) {
      const manifestPath = resolve(directory, 'package.json');
      const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
      if (manifest?.name && manifest?.version) {
        packages.set(directory, manifest);
        found = true;
        break;
      }
      directory = dirname(directory);
    }
    if (!found) throw new Error(`Missing package metadata for bundled input: ${input}`);
  }
  const notices = [];
  for (const [directory, manifest] of packages) {
    const identity = `${manifest.name}@${manifest.version}`;
    const license = typeof manifest.license === 'string' ? manifest.license : manifest.license?.type;
    if (!license) throw new Error(`Missing license identifier for ${identity}`);
    let licenseDirectory = directory;
    let licenseLabel = '';
    let licenseFiles = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^(licen[cs]e|copying)([.-]|$)/i.test(entry.name))
      .map((entry) => entry.name).sort();
    // Some ethers v5 subpackage tarballs omit LICENSE. The umbrella package
    // carries the monorepo license; require its exact dependency version and
    // repository to match before using that local text for a subpackage.
    if (!licenseFiles.length && manifest.name.startsWith('@ethersproject/') && /^5\./.test(manifest.version) && license === 'MIT') {
      let umbrellaPath;
      try { umbrellaPath = createRequire(resolve(directory, 'package.json')).resolve('ethers/package.json'); } catch { /* Missing evidence fails below. */ }
      if (umbrellaPath) {
        const umbrella = JSON.parse(readFileSync(umbrellaPath, 'utf8'));
        if (umbrella.name === 'ethers' && /^5\./.test(umbrella.version) && umbrella.license === 'MIT' &&
            umbrella.repository?.url === 'git://github.com/ethers-io/ethers.js.git' &&
            manifest.repository?.url === umbrella.repository.url && umbrella.dependencies?.[manifest.name] === manifest.version &&
            existsSync(resolve(dirname(umbrellaPath), 'LICENSE.md'))) {
          licenseDirectory = dirname(umbrellaPath);
          licenseLabel = 'ethers monorepo ';
          licenseFiles = ['LICENSE.md'];
        }
      }
    }
    const texts = licenseFiles.map((name) => `### ${licenseLabel}${name}\n\n${readFileSync(resolve(licenseDirectory, name), 'utf8').replace(/\r\n/g, '\n').trim()}`);
    // Some small MIT packages publish the full grant in their README only.
    // A bare "MIT" label is not license text and must still fail closed.
    if (!texts.length && license === 'MIT') {
      for (const name of readdirSync(directory).filter((name) => /^readme(?:\.|$)/i.test(name)).sort()) {
        const readme = readFileSync(resolve(directory, name), 'utf8').replace(/\r\n/g, '\n');
        const section = readme.match(/(?:^|\n)#{1,6}\s+licen[cs]e[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|$)/i)?.[1]?.trim();
        const normalized = section?.replace(/\s+/g, ' ');
        if (normalized && /Permission is hereby granted/.test(normalized) && /THE SOFTWARE IS PROVIDED.*AS IS/i.test(normalized) && /USE OR OTHER DEALINGS IN THE SOFTWARE/i.test(normalized)) {
          texts.push(`### ${name} license section\n\n${section}`);
        }
      }
    }
    if (!texts.length) throw new Error(`Missing license text for ${identity}`);
    notices.push(`## ${identity}\n\nLicense: ${license}\n\n${texts.join('\n\n')}`);
  }
  return `# Third-party notices\n\nGenerated from Worker bundle inputs. These packages retain their own licenses.\n\n${notices.sort().join('\n\n---\n\n')}\n`;
};

