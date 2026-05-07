import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const resolveExistingComponentPath = (...candidates) => {
  for (const relativePath of candidates) {
    const absolutePath = resolve(REPO_ROOT, relativePath);
    if (existsSync(absolutePath)) return absolutePath;
  }

  assert.fail(`Expected one of these component paths to exist: ${candidates.join(', ')}`);
};

const CREATE_SURVEY_PATH = resolveExistingComponentPath(
  'client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx',
  'client/src/components/SurveyTool/CreateQuestionsAndSurveys.jsx',
);
const SURVEY_GENERATOR_HELPERS_PATH = resolveExistingComponentPath(
  'client/src/components/SurveyTool/SurveyGenerator/surveyGeneratorHelpers.ts',
  'client/src/components/SurveyTool/SurveyGenerator/surveyGeneratorHelpers.js',
);
const AUDIO_SURVEY_GENERATOR_PATH = resolveExistingComponentPath(
  'client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx',
  'client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.jsx',
);

test('CreateQuestionsAndSurveys and SurveyGenerator both route question IDs through shared utility', () => {
  const createSurvey = readFileSync(CREATE_SURVEY_PATH, 'utf8');
  const surveyGeneratorHelpers = readFileSync(SURVEY_GENERATOR_HELPERS_PATH, 'utf8');
  const audioSurveyGenerator = readFileSync(AUDIO_SURVEY_GENERATOR_PATH, 'utf8');

  assert.match(
    createSurvey,
    /import\s+\{\s*generateQuestionId\s+as\s+generateSharedQuestionId\s*\}\s+from\s+'..\/..\/utilities\/shared\/questionUtils\.mjs';/,
  );
  assert.match(
    createSurvey,
    /return\s+(?:generateSharedQuestionId|generateSharedQuestionIdForCreateSurvey)\(type,\s*prompt,\s*options,\s*singleSelect\);/,
  );

  assert.match(
    surveyGeneratorHelpers,
    /import\s+\{\s*generateQuestionId\s+as\s+generateSharedQuestionId\s*\}\s+from\s+'\.\.\/\.\.\/\.\.\/utilities\/shared\/questionUtils\.mjs';/,
  );
  assert.match(
    surveyGeneratorHelpers,
    /id:\s*generateSharedQuestionId\(question\.questionType,\s*question\.prompt,\s*question\.options\s*\|\|\s*\[\]\)/,
  );
  assert.match(audioSurveyGenerator, /buildGeneratedSurveyStatements\(\{/);
});
