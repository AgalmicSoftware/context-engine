import fs from 'fs';
import path from 'path';

const readSurveyToolScss = () => fs.readFileSync(path.join(__dirname, 'SurveyTool.module.scss'), 'utf8');

const checks = [
  /\.pileCard,[\s\S]*?transition-duration: 0\.01ms !important;/,
  /\.pileFooter\s+\.pileSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/,
  /\.headerSubmitButton\.submitGlow::before,\s*[\s\S]*?animation:\s*none !important;/,
];
const reducedMotionBodies = (text: string): string[] => {
  const condition = '@media (prefers-reduced-motion: reduce) {';
  const bodies: string[] = [];
  let from = text.indexOf(condition);
  while (from >= 0) {
    let depth = 0;
    let end = from + condition.length - 1;
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1;
      else if (text[end] === '}' && --depth === 0) break;
    }
    bodies.push(text.slice(from + condition.length, end));
    from = text.indexOf(condition, end);
  }
  return bodies;
};
const motionGuardPasses = (text: string) =>
  checks.every((check) => reducedMotionBodies(text).some((body) => check.test(body)));
it.each(checks)('keeps each pile and submit motion rule inside reduced motion (%s)', (check) => {
  expect(reducedMotionBodies(readSurveyToolScss()).some((body) => check.test(body))).toBe(true);
});
it('rejects rules moved out of their reduced-motion block', () => {
  const text = readSurveyToolScss();
  const condition = '@media (prefers-reduced-motion: reduce) {';
  const start = text.lastIndexOf(condition);
  expect(start).toBeGreaterThan(0);
  const mutated = text.slice(0, start) + '@media (min-width: 0) {' + text.slice(start + condition.length);
  expect(motionGuardPasses(text)).toBe(true);
  expect(motionGuardPasses(mutated)).toBe(false);
});
