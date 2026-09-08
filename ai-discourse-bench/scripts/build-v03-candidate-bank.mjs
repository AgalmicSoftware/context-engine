#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildV03Bank, defaultV03Paths } from '../src/v03-bank.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
const allowViolations = args.has('--allow-violations');
const paths = defaultV03Paths(packageRoot);

const main = async () => {
  if (!fs.existsSync(paths.authoringDirectory)) {
    throw new Error(`authoring directory not found: ${paths.authoringDirectory}`);
  }
  const result = await buildV03Bank({
    authoringDirectory: paths.authoringDirectory,
    corpusRoot: paths.corpusRoot,
  });
  const { bank, manifest, audit, humanReviewCsv, coverageReport, violations, schemaErrors } = result;

  console.log(`items: ${bank.questions.length}`);
  console.log(`agent track: ${audit.stats.agentTrackCount}`);
  console.log(`intervention share (directed): ${audit.stats.bankWideInterventionShare}`);
  console.log(`roles: ${JSON.stringify(audit.stats.roleCounts)}`);
  console.log(`schema errors: ${schemaErrors.length}`);
  console.log(`constraint violations: ${violations.length}`);
  violations.slice(0, 80).forEach((violation) => console.log(`  - ${violation}`));
  if (violations.length > 80) console.log(`  ... ${violations.length - 80} more`);
  schemaErrors.slice(0, 20).forEach((error) => console.log(`  schema: ${error}`));

  const failed = schemaErrors.length > 0 || (violations.length > 0 && !allowViolations);
  if (checkOnly) {
    process.exitCode = failed ? 1 : 0;
    return;
  }
  if (schemaErrors.length > 0) {
    throw new Error('refusing to write a bank with schema errors');
  }
  fs.mkdirSync(paths.outputDirectory, { recursive: true });
  const write = (name, content) => fs.writeFileSync(path.join(paths.outputDirectory, name), content);
  write('question-bank.json', `${JSON.stringify(bank, null, 2)}\n`);
  write('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  write('generation-audit.json', `${JSON.stringify(audit, null, 2)}\n`);
  write('human-review.csv', humanReviewCsv);
  write('coverage-report.md', coverageReport);
  console.log(`wrote ${paths.outputDirectory}`);
  process.exitCode = failed ? 1 : 0;
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
