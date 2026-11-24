import fs from 'node:fs';
import path from 'node:path';
import * as sass from 'sass';

// Agree / Unsure / Disagree took the font of the panel around them: the theme's body font on the question pile, a
// monospace in the interview's review and on a debate atlas node's questions. One mixin now sets their type
// everywhere they are drawn, as the pile has it.
const srcDir = path.resolve(__dirname, '..');
const compile = (file: string) =>
  sass.compile(path.resolve(srcDir, file), { loadPaths: [srcDir], style: 'expanded', logger: sass.Logger.silent }).css;
const declarations = (css: string, selector: RegExp) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selector.test(selectors.trim()))
    .map(([, , body]) => body)
    .join('');
const PILE_TYPE =
  /font-family: var\(--ce-font-body\);\s*font-weight: 400;\s*font-style: normal;\s*letter-spacing: normal;\s*text-transform: none;/;

describe('the type of Agree / Unsure / Disagree', () => {
  it('comes from one mixin: the theme body font at its normal weight', () => {
    const mixin = fs.readFileSync(path.join(srcDir, 'scss/_answerChoiceType.scss'), 'utf8');
    expect(mixin).toMatch(/@mixin answer-choice-type \{/);
    expect(mixin).toMatch(PILE_TYPE);
  });

  it.each([
    [
      'the session answer buttons (pile, interview review, AI prefill review)',
      'components/SurveyTool/SurveyTool.module.scss',
      /^#binaryChoice \.radioOptionText$/,
    ],
    ['a debate atlas node’s questions', 'components/DebateMap/DebateMap.module.scss', /\.binaryPills > span$/],
  ])('is the pile’s on %s', (_where, file, selector) => {
    const source = fs.readFileSync(path.join(srcDir, file), 'utf8');
    expect(source).toMatch(/@use 'scss\/answerChoiceType' as answerChoiceType;/);
    expect(source).toMatch(/@include answerChoiceType\.answer-choice-type;/);
    expect(declarations(compile(file), selector)).toMatch(PILE_TYPE);
  });
});
