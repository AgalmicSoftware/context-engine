'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const TRACKED_ANCHOR_FILES = Object.freeze([
  'AGENTS.md',
  'ARCHITECTURE.md',
  'client/src/variables/demo/LOOPHOLE_SCHEMA.md',
  'client/src/variables/demo/README.md',
  'docs/MainSite.MAP.md',
  'docs/SessionWizard.MAP.md',
  'docs/SurveyTool.MAP.md',
  'docs/arweave-payloads.md',
  'docs/e2e-testid-api.md',
  'docs/lit-v3-design.md',
  'docs/passkey-wallet.md',
  'docs/repo-structure.md',
  'scripts/audit-full.sh',
  'spec.md',
]);

const MIGRATED_COMPONENT_DOC_PATHS = Object.freeze([
  'client/src/components/About/AboutPage.tsx',
  'client/src/components/Account/LoginAndSettingsModal.tsx',
  'client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx',
  'client/src/components/DocumentLibrary/SessionDocumentsPage.tsx',
  'client/src/components/DemoViews/DemosIndex.tsx',
  'client/src/components/DemoViews/RiskMatrixDemo.tsx',
  'client/src/components/DebateMap/DebateMap.tsx',
  'client/src/components/MainSite/MainSite.tsx',
  'client/src/components/MainContent/MainAreaTabs.tsx',
  'client/src/components/MainContent/ToolExplorer.tsx',
  'client/src/components/Navbar/AccountSection.tsx',
  'client/src/components/OnePageSession/OnePageSession.tsx',
  'client/src/components/SBTs/CreateSBTGroup.tsx',
  'client/src/components/SBTs/SBTPage.tsx',
  'client/src/components/SBTs/SBTSelector.tsx',
  'client/src/components/Sessions/SessionWizard.tsx',
  'client/src/components/Shared/AudioInput/AudioInput.tsx',
  'client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx',
  'client/src/components/SurveyTool/QuestionFilter.tsx',
  'client/src/components/SurveyTool/SingleQuestionResponse.tsx',
  'client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx',
  'client/src/components/SurveyTool/SurveyResults.tsx',
  'client/src/components/SurveyTool/SurveyTool.tsx',
  'client/src/components/UserPage/CompareAddresses.tsx',
  'client/src/components/UserPage/UserPage.tsx',
]);

const toLegacyJsxPath = (relativePath) => relativePath.replace(/\.tsx$/, '.jsx');

const OPTIONAL_WORKFLOW_SKILL_CHECKS = Object.freeze([
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/session-setup-flow/SKILL.md',
    stalePaths: [toLegacyJsxPath('client/src/components/Sessions/SessionWizard.tsx')],
    livePaths: ['client/src/components/Sessions/SessionWizard.tsx'],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/sbt-collect-flow/SKILL.md',
    stalePaths: [toLegacyJsxPath('client/src/components/SBTs/SBTPage.tsx')],
    livePaths: ['client/src/components/SBTs/SBTPage.tsx'],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/sbt-create-flow/SKILL.md',
    stalePaths: [
      toLegacyJsxPath('client/src/components/SBTs/CreateSBTGroup.tsx'),
      toLegacyJsxPath('client/src/components/SBTs/SBTPage.tsx'),
    ],
    livePaths: [
      'client/src/components/SBTs/CreateSBTGroup.tsx',
      'client/src/components/SBTs/SBTPage.tsx',
    ],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/survey-authoring-flow/SKILL.md',
    stalePaths: [toLegacyJsxPath('client/src/components/SurveyTool/CreateSurvey.tsx')],
    livePaths: ['client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx'],
  },
  {
    skillPath: 'scripts/lib/e2e/workflow-skills/survey-response-flow/SKILL.md',
    stalePaths: [
      'client/src/components/SurveyTool/AudioInput.tsx',
      toLegacyJsxPath('client/src/components/SurveyTool/AudioInput.tsx'),
      toLegacyJsxPath('client/src/components/SurveyTool/SingleQuestionResponse.tsx'),
      toLegacyJsxPath('client/src/components/SurveyTool/SurveyResults.tsx'),
    ],
    livePaths: [
      'client/src/components/Shared/AudioInput/AudioInput.tsx',
      'client/src/components/SurveyTool/SingleQuestionResponse.tsx',
      'client/src/components/SurveyTool/SurveyResults.tsx',
    ],
  },
]);

test('tracked anchor files do not reference stale JSX component paths after the TSX migration', () => {
  MIGRATED_COMPONENT_DOC_PATHS.forEach((livePath) => {
    assert.equal(fs.existsSync(path.join(ROOT, livePath)), true, `${livePath} should exist`);
  });

  TRACKED_ANCHOR_FILES.forEach((relativePath) => {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    MIGRATED_COMPONENT_DOC_PATHS.map(toLegacyJsxPath).forEach((stalePath) => {
      assert.equal(
        source.includes(stalePath),
        false,
        `${relativePath} should not reference stale component path ${stalePath}`,
      );
    });
  });
});

test('local workflow skill anchors point at live component files when the private workflow tree is present', () => {
  OPTIONAL_WORKFLOW_SKILL_CHECKS.forEach(({ skillPath, stalePaths, livePaths, livePathAlternates = [] }) => {
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
    const alternateMembers = new Set(livePathAlternates.flat());
    livePaths
      .filter((livePath) => !alternateMembers.has(livePath))
      .forEach((livePath) => {
      assert.equal(fs.existsSync(path.join(ROOT, livePath)), true, `${livePath} should exist`);
      assert.equal(
        source.includes(livePath),
        true,
        `${skillPath} should reference live component path ${livePath}`,
      );
    });

    livePathAlternates.forEach((alternatePaths) => {
      alternatePaths.forEach((livePath) => {
        assert.equal(fs.existsSync(path.join(ROOT, livePath)), true, `${livePath} should exist`);
      });
      assert.equal(
        alternatePaths.some((livePath) => source.includes(livePath)),
        true,
        `${skillPath} should reference at least one live component path from: ${alternatePaths.join(', ')}`,
      );
    });
  });
});
