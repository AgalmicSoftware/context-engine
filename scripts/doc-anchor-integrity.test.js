'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const TRACKED_DOC_FILES = Object.freeze([
  'AGENTS.md',
  'docs/MainSite.MAP.md',
  'docs/SessionWizard.MAP.md',
  'docs/SurveyTool.MAP.md',
  'docs/arweave-payloads.md',
  'docs/e2e-testid-api.md',
  'docs/porto-information.md',
  'docs/repo-structure.md',
]);

const STALE_COMPONENT_DOC_PATHS = Object.freeze([
  'client/src/components/About/AboutPage.jsx',
  'client/src/components/Account/LoginAndSettingsModal.jsx',
  'client/src/components/DocumentLibrary/DocumentLibraryPanel.jsx',
  'client/src/components/DocumentLibrary/SessionDocumentsPage.jsx',
  'client/src/components/DemoViews/DemosIndex.jsx',
  'client/src/components/DemoViews/RiskMatrixDemo.jsx',
  'client/src/components/MainContent/MainAreaTabs.jsx',
  'client/src/components/MainContent/ToolExplorer.jsx',
  'client/src/components/Navbar/AccountSection.jsx',
  'client/src/components/OnePageSession/OnePageSession.jsx',
  'client/src/components/SBTs/CreateSBTGroup.jsx',
  'client/src/components/SBTs/SBTPage.jsx',
  'client/src/components/SBTs/SBTSelector.jsx',
  'client/src/components/Sessions/SessionWizard.jsx',
  'client/src/components/Shared/AudioInput/AudioInput.jsx',
  'client/src/components/SurveyTool/AudioInput.jsx',
  'client/src/components/SurveyTool/CreateQuestionsAndSurveys.jsx',
  'client/src/components/SurveyTool/QuestionFilter.jsx',
  'client/src/components/SurveyTool/SingleQuestionResponse.jsx',
  'client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.jsx',
  'client/src/components/SurveyTool/SurveyResults.jsx',
  'client/src/components/UserPage/CompareAddresses.jsx',
  'client/src/components/UserPage/UserPage.jsx',
]);

const OPTIONAL_WORKFLOW_SKILL_CHECKS = Object.freeze([
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/session-setup-flow/SKILL.md',
    stalePaths: ['client/src/components/Sessions/SessionWizard.jsx'],
    livePaths: ['client/src/components/Sessions/SessionWizard.tsx'],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/sbt-collect-flow/SKILL.md',
    stalePaths: ['client/src/components/SBTs/SBTPage.jsx'],
    livePaths: ['client/src/components/SBTs/SBTPage.tsx'],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/sbt-create-flow/SKILL.md',
    stalePaths: [
      'client/src/components/SBTs/CreateSBTGroup.jsx',
      'client/src/components/SBTs/SBTPage.jsx',
    ],
    livePaths: [
      'client/src/components/SBTs/CreateSBTGroup.tsx',
      'client/src/components/SBTs/SBTPage.tsx',
    ],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/survey-authoring-flow/SKILL.md',
    stalePaths: ['client/src/components/SurveyTool/CreateSurvey.jsx'],
    livePaths: ['client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx'],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/survey-response-flow/SKILL.md',
    stalePaths: [
      'client/src/components/SurveyTool/AudioInput.jsx',
      'client/src/components/SurveyTool/SingleQuestionResponse.jsx',
      'client/src/components/SurveyTool/SurveyResults.jsx',
    ],
    livePaths: [
      'client/src/components/SurveyTool/AudioInput.tsx',
      'client/src/components/SurveyTool/SingleQuestionResponse.tsx',
      'client/src/components/SurveyTool/SurveyResults.tsx',
    ],
  },
]);

test('tracked docs do not reference stale JSX component paths after the TSX migration', () => {
  TRACKED_DOC_FILES.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    STALE_COMPONENT_DOC_PATHS.forEach((stalePath) => {
      assert.equal(
        source.includes(stalePath),
        false,
        `${relativePath} should not reference stale component path ${stalePath}`,
      );
    });
  });
});

test('local workflow skill anchors point at live component files when the private workflow tree is present', () => {
  OPTIONAL_WORKFLOW_SKILL_CHECKS.forEach(({ skillPath, stalePaths, livePaths }) => {
    const absoluteSkillPath = path.join(ROOT, skillPath);
    if (!fs.existsSync(absoluteSkillPath)) return;

    const source = fs.readFileSync(absoluteSkillPath, 'utf8');
    stalePaths.forEach((stalePath) => {
      assert.equal(
        source.includes(stalePath),
        false,
        `${skillPath} should not reference stale component path ${stalePath}`,
      );
    });
    livePaths.forEach((livePath) => {
      assert.equal(fs.existsSync(path.join(ROOT, livePath)), true, `${livePath} should exist`);
      assert.equal(
        source.includes(livePath),
        true,
        `${skillPath} should reference live component path ${livePath}`,
      );
    });
  });
});
