const fs = require('fs');
const path = require('path');

const readClientFile = (relativePath) => fs.readFileSync(path.resolve(__dirname, '../..', relativePath), 'utf8');

const findUnusedSimpleBindings = (relativePath, sourceName) => {
  const source = readClientFile(relativePath);
  const start = source.indexOf('  const {');
  const closeMarker = `  } = ${sourceName};`;
  const end = source.indexOf(closeMarker, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  const bindingBlock = source.slice(start, end);
  const remainder = source.slice(end + closeMarker.length);
  const bindings = [...bindingBlock.matchAll(/^ {4}([A-Za-z_$][A-Za-z0-9_$]*),$/gm)].map((match) => match[1]);

  return bindings.filter((binding) => !new RegExp(`\\b${binding}\\b`).test(remainder));
};

describe('runtime context plumbing', () => {
  test.each([
    ['components/SurveyTool/surveyQuestionsRuntimeMethods.tsx', 'context'],
    ['components/SurveyTool/surveyQuestionsDataRuntime.ts', 'context'],
    ['components/SurveyTool/surveyQuestionsRuntimeStateRuntime.ts', 'context'],
    ['utilities/web3/contractScripts.surveyEventReadMethods.ts', 'deps'],
    ['utilities/web3/contractScripts.sbtMintMethods.ts', 'deps'],
    ['utilities/web3/contractScripts.surveyWriteMethods.ts', 'deps'],
    ['utilities/web3/contractScripts.sbtRegistryMethods.ts', 'deps'],
    ['utilities/web3/contractScripts.surveyPayloadReadMethods.ts', 'deps'],
  ])('%s does not retain unused dependency bindings', (relativePath, sourceName) => {
    expect(findUnusedSimpleBindings(relativePath, sourceName)).toEqual([]);
  });
});
