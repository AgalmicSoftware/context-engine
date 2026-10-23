#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { correctSavedReportDistributions } from '../src/saved-report-correction.mjs';

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath || sourcePath === outputPath) {
  throw new Error('usage: node scripts/correct-saved-report-distributions.mjs <source-report.json> <new-report.json>');
}
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const corrected = correctSavedReportDistributions(source);
await writeFile(outputPath, `${JSON.stringify(corrected, null, 2)}\n`, { flag: 'wx' });
console.log(`corrected saved distributions in ${outputPath}; original runs were not revalidated`);
