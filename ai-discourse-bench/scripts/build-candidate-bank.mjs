import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCandidateBank, defaultCandidatePaths } from '../src/candidate-bank.mjs';
import { readJsonFile, writeJsonFile } from '../src/io.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = defaultCandidatePaths(packageRoot);
const seedBank = await readJsonFile(paths.seedBankPath);
const { bank, manifest } = await buildCandidateBank({
  seedBank,
  corpusRoot: paths.corpusRoot,
  packageRoot,
});

await writeJsonFile(path.join(paths.outputDirectory, 'question-bank.json'), bank);
await writeJsonFile(path.join(paths.outputDirectory, 'manifest.json'), manifest);
console.log(`wrote ${bank.questions.length} candidate questions to ${paths.outputDirectory}`);
