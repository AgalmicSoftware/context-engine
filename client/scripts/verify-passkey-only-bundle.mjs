import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(clientRoot, 'build');
const profilePath = path.join(buildDir, 'ce-wallet-profile.json');

const listFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  });

const fail = (message) => {
  console.error(`passkey-only bundle verification failed: ${message}`);
  process.exitCode = 1;
};

if (!fs.existsSync(profilePath)) {
  fail('client/build/ce-wallet-profile.json is missing; run npm run build first');
} else {
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  if (profile.metaMaskConnectorEnabled !== false) {
    fail('the current build was produced with MetaMask enabled');
  }
  if (profile.passkeyOnlyBundleGuard !== 'passed') {
    fail('the Vite module-graph guard did not report a pass');
  }

  const files = listFiles(buildDir);
  const forbiddenFilenames = files
    .map((filePath) => path.relative(buildDir, filePath).split(path.sep).join('/'))
    .filter((relativePath) => /metamask/i.test(relativePath));
  if (forbiddenFilenames.length) {
    fail(`MetaMask-named files are present: ${forbiddenFilenames.join(', ')}`);
  }

  const textPatterns = [
    ['MetaMask connector class', /MetaMaskConnector/],
    ['RainbowKit MetaMask wallet factory', /metaMaskWallet/],
    ['MetaMask login control', /Open Crypto Login \(RainbowKit\)/],
  ];
  const textFiles = files.filter((filePath) => /\.(?:css|html|js|json|map|txt)$/i.test(filePath));
  for (const filePath of textFiles) {
    const contents = fs.readFileSync(filePath, 'utf8');
    for (const [label, pattern] of textPatterns) {
      if (pattern.test(contents)) {
        fail(`${label} found in ${path.relative(buildDir, filePath)}`);
      }
    }
  }

  if (process.exitCode !== 1) {
    console.log('passkey-only bundle verification passed');
  }
}
