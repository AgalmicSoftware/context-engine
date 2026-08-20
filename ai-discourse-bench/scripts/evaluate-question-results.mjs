import path from 'node:path';

import { readJsonFile, writeJsonFile, writeTextFile } from '../src/io.mjs';
import {
  annotateQuestionEvaluationReviewStatus,
  evaluateQuestionReport,
  renderQuestionEvaluationCsv,
} from '../src/question-evaluation.mjs';

const args = process.argv.slice(2);
const valueFor = (flag, fallback = '') => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const reportPath = valueFor('--report');
if (!reportPath) {
  throw new Error('Usage: node scripts/evaluate-question-results.mjs --report <report.json> [--out <evaluation.json>] [--csv <evaluation.csv>]');
}

const outPath = valueFor('--out', reportPath.replace(/\.json$/i, '-question-evaluation.json'));
const csvPath = valueFor('--csv', outPath.replace(/\.json$/i, '.csv'));
const reviewedBankPath = valueFor('--reviewed-bank');
const report = await readJsonFile(reportPath);
const baseEvaluation = evaluateQuestionReport(report);
const reviewedBank = reviewedBankPath ? await readJsonFile(reviewedBankPath) : null;
const evaluation = reviewedBankPath
  ? annotateQuestionEvaluationReviewStatus(
    baseEvaluation,
    reviewedBank,
  )
  : baseEvaluation;

await writeJsonFile(outPath, evaluation);
await writeTextFile(csvPath, renderQuestionEvaluationCsv(evaluation));

console.log(`evaluated ${evaluation.summary.questionCount} questions from ${path.basename(reportPath)}`);
console.log(`recommendations: ${JSON.stringify(evaluation.summary.recommendations)}`);
console.log(`wrote ${outPath}`);
console.log(`wrote ${csvPath}`);
