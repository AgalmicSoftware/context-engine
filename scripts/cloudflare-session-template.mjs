import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWorkerBundles } from './worker-bundle.mjs';

const TEMPLATE_RELATIVE_DIR = 'deploy/cloudflare/session-worker';
const BUNDLE_RELATIVE_PATH = 'dist/sessionCorsWorker.bundle.js';
const TEMPLATE_BUNDLE_FILE = 'worker.mjs';
const TEMPLATE_MANIFEST_FILE = 'template-manifest.json';
const TEMPLATE_INPUT_FILES = Object.freeze([
  TEMPLATE_BUNDLE_FILE,
  'wrangler.jsonc',
  'package.json',
  '.dev.vars.example',
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.md',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

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
    const licenseFiles = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^(licen[cs]e|copying)([.-]|$)/i.test(entry.name))
      .map((entry) => entry.name).sort();
    if (!licenseFiles.length) throw new Error(`Missing license text for ${identity}`);
    const texts = licenseFiles.map((name) => `### ${name}\n\n${readFileSync(resolve(directory, name), 'utf8').trim()}`);
    notices.push(`## ${identity}\n\nLicense: ${license}\n\n${texts.join('\n\n')}`);
  }
  return `# Third-party notices\n\nGenerated from the Session Worker bundle inputs. These packages retain their own licenses.\n\n${notices.sort().join('\n\n---\n\n')}\n`;
};

const readRequiredFile = (path, label) => {
  if (!existsSync(path)) throw new Error(`${label} is missing: ${path}`);
  return readFileSync(path);
};

const assertDeployableBundle = (bundle) => {
  const source = bundle.toString('utf8');
  if (!/SessionWriteCoordinator/.test(source) || !/export\s*\{[^}]*SessionWriteCoordinator/s.test(source)) {
    throw new Error('Generated Session Worker bundle is missing the SessionWriteCoordinator export.');
  }
  if (!/export\s*\{[^}]*[^}]*default\s+as\s+default/s.test(source)) {
    throw new Error('Generated Session Worker bundle is missing its default Worker export.');
  }
};

const writeBundleDigestBinding = ({ templateDir, bundle }) => {
  const configPath = resolve(templateDir, 'wrangler.jsonc');
  const config = JSON.parse(readRequiredFile(configPath, 'Cloudflare template Wrangler config').toString('utf8'));
  if (!config.vars || typeof config.vars !== 'object' || Array.isArray(config.vars)) {
    throw new Error('Cloudflare template Wrangler config must define a vars object.');
  }
  config.vars.CE_BUNDLE_SHA256 = sha256(bundle);
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
};

const assertBundleDigestBinding = ({ templateDir, bundle }) => {
  const configPath = resolve(templateDir, 'wrangler.jsonc');
  const config = JSON.parse(readRequiredFile(configPath, 'Cloudflare template Wrangler config').toString('utf8'));
  if (String(config?.vars?.CE_BUNDLE_SHA256 || '').trim().toLowerCase() !== sha256(bundle)) {
    throw new Error(
      'Cloudflare Session Worker deploy package bundle digest binding is out of sync; ' +
      'run "npm run worker:cloudflare-template".',
    );
  }
};

const buildManifest = ({ rootDir }) => {
  const templateDir = resolve(rootDir, TEMPLATE_RELATIVE_DIR);
  const files = {};
  for (const name of TEMPLATE_INPUT_FILES) {
    const contents = readRequiredFile(resolve(templateDir, name), `Cloudflare template file ${name}`);
    files[name] = {
      bytes: contents.byteLength,
      sha256: sha256(contents),
    };
  }
  const packageIdentity = Buffer.from(
    TEMPLATE_INPUT_FILES.map((name) => `${name}:${files[name].sha256}:${files[name].bytes}`).join('\n'),
  );
  return {
    schemaVersion: 1,
    kind: 'context-engine-session-worker-deploy-button',
    generatedFrom: 'workers/sessionCorsWorker/worker.js',
    generator: 'scripts/cloudflare-session-template.mjs',
    files,
    packageSha256: sha256(packageIdentity),
  };
};

const runBundleBuild = async ({ rootDir, buildBundles }) => {
  const results = await buildBundles({ rootDir, targetKeys: ['sessionCorsWorker'] });
  const bundlePath = resolve(rootDir, BUNDLE_RELATIVE_PATH);
  const bundle = readRequiredFile(bundlePath, 'Generated Session Worker bundle');
  assertDeployableBundle(bundle);
  const notices = buildWorkerThirdPartyNotices({ rootDir, metafile: results?.find((result) => result.key === 'sessionCorsWorker')?.metafile });
  return { bundle, bundlePath, notices };
};

export const buildCloudflareSessionTemplate = async ({
  rootDir = process.cwd(),
  buildBundles = buildWorkerBundles,
} = {}) => {
  const templateDir = resolve(rootDir, TEMPLATE_RELATIVE_DIR);
  const templateBundlePath = resolve(templateDir, TEMPLATE_BUNDLE_FILE);
  const { bundle, bundlePath, notices } = await runBundleBuild({ rootDir, buildBundles });
  copyFileSync(bundlePath, templateBundlePath);
  writeFileSync(resolve(templateDir, 'THIRD_PARTY_NOTICES.md'), notices);
  writeBundleDigestBinding({ templateDir, bundle });
  const manifest = buildManifest({ rootDir });
  writeFileSync(
    resolve(templateDir, TEMPLATE_MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
};

export const verifyCloudflareSessionTemplate = async ({
  rootDir = process.cwd(),
  buildBundles = buildWorkerBundles,
} = {}) => {
  const templateDir = resolve(rootDir, TEMPLATE_RELATIVE_DIR);
  const trackedBundle = readRequiredFile(
    resolve(templateDir, TEMPLATE_BUNDLE_FILE),
    'Tracked Cloudflare template Worker bundle',
  );
  const { bundle, notices } = await runBundleBuild({ rootDir, buildBundles });
  if (!trackedBundle.equals(bundle)) {
    throw new Error(
      'Cloudflare Session Worker deploy package is out of sync; run "npm run worker:cloudflare-template".',
    );
  }
  assertBundleDigestBinding({ templateDir, bundle });
  if (readRequiredFile(resolve(templateDir, 'THIRD_PARTY_NOTICES.md'), 'Third-party notices').toString('utf8') !== notices) {
    throw new Error('Cloudflare Session Worker third-party notices are out of sync; run "npm run worker:cloudflare-template".');
  }
  const expectedManifest = buildManifest({ rootDir });
  const manifestPath = resolve(templateDir, TEMPLATE_MANIFEST_FILE);
  const trackedManifest = JSON.parse(
    readRequiredFile(manifestPath, 'Tracked Cloudflare template manifest').toString('utf8'),
  );
  if (JSON.stringify(trackedManifest) !== JSON.stringify(expectedManifest)) {
    throw new Error(
      'Cloudflare Session Worker deploy package manifest is out of sync; run "npm run worker:cloudflare-template".',
    );
  }
  return expectedManifest;
};

const parseArgs = (argv) => {
  if (argv.length === 0) return { check: false };
  if (argv.length === 1 && argv[0] === '--check') return { check: true };
  throw new Error(`Usage: node ${relative(process.cwd(), fileURLToPath(import.meta.url))} [--check]`);
};

const isEntrypoint = () => resolve(process.argv[1] || '') === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint()) {
  const { check } = parseArgs(process.argv.slice(2));
  const manifest = check
    ? await verifyCloudflareSessionTemplate()
    : await buildCloudflareSessionTemplate();
  console.log(
    `${check ? 'Verified' : 'Built'} Cloudflare Session Worker deploy package ${manifest.packageSha256}.`,
  );
}
