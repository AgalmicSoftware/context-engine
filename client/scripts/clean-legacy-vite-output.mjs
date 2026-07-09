import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep this prebuild cleanup while older local checkouts may still have stale
// Vite output in build-vite/ or vite-build/; current builds write to build/.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(scriptDir, '..');
const legacyOutputDirs = ['build-vite', 'vite-build'];

const resolveLegacyOutputDir = (dirName) => {
  const targetDir = path.resolve(clientDir, dirName);
  if (path.dirname(targetDir) !== clientDir || !legacyOutputDirs.includes(path.basename(targetDir))) {
    throw new Error(`Refusing to clean unexpected path: ${targetDir}`);
  }
  return targetDir;
};

legacyOutputDirs.forEach((dirName) => {
  const targetDir = resolveLegacyOutputDir(dirName);
  if (!fs.existsSync(targetDir)) return;
  fs.rmSync(targetDir, { recursive: true, force: true });
  console.log(`Removed stale legacy Vite output: ${dirName}`);
});
