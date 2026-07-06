'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const LARGE_FILE_LINE_LIMIT = 1000;
const LARGE_FILE_GROWTH_TOLERANCE = 25;
const LARGE_FILE_SHRINK_TOLERANCE = 100;

const LARGE_CLIENT_FILE_BASELINE = Object.freeze({
  'client/src/components/SurveyTool/SurveyQuestions.tsx': 8761,
  'client/src/components/MainSite/MainSite.tsx': 6736,
  'client/src/components/SurveyTool/SurveyResults.tsx': 4884,
  'client/src/utilities/web3/contractScripts.impl.ts': 4691,
  'client/src/components/SBTs/SBTPage.tsx': 4214,
  'client/src/components/Sessions/SessionWizard.tsx': 4546,
  'client/src/components/UserPage/UserPage.tsx': 3784,
  'client/src/components/SBTs/CreateSBTGroup.tsx': 4629,
  'client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx': 3919,
  'client/src/components/PolisReport/PolisReport.tsx': 4083,
  'client/src/components/SurveyTool/QuestionFilter.tsx': 3735,
  'client/src/components/Admin/AdminPage.tsx': 3573,
  'client/src/components/SBTs/SBTsList.tsx': 3211,
  'client/src/components/DebateMap/DebateMap.tsx': 3533,
  'client/src/components/Account/LoginAndSettingsModal.tsx': 3111,
  'client/src/components/UserPage/CompareAddresses.tsx': 2900,
  'client/src/components/OnePageSession/OnePageSession.tsx': 2897,
  'client/src/components/SurveyTool/surveyToolHydrationFlow.ts': 2840,
  'client/src/components/SurveyTool/SurveyPileViewMode.tsx': 3020,
  'client/src/utilities/arweave/arweaveScripts.js': 2703,
  'client/src/utilities/web3/sessionRegistry.ts': 2571,
  'client/src/components/SBTs/SBTSelector.tsx': 2267,
  'client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx': 2114,
  'client/src/utilities/survey/sessionQuestionCacheController.ts': 2200,
  'client/src/utilities/ai/aiScripts.js': 2091,
  'client/src/components/CommunityTab/CommunityTab.tsx': 2127,
  'client/src/components/SurveyTool/SurveySelector.tsx': 2103,
  'client/src/utilities/sbt/sessionSbtCacheController.js': 2191,
  'client/src/utilities/crypto/cryptography.ts': 2433,
  'client/src/utilities/crypto/litProtocol.ts': 2184,
  'client/src/components/SurveyTool/surveyToolDecryptFlow.js': 2038,
  'client/src/components/SBTs/sbtPageActionDisplayHelpers.ts': 1616,
  'client/src/components/UserPage/userPageHelpers.ts': 1540,
  'client/src/components/SurveyTool/surveyQuestionsTypes.ts': 2373,
  'client/src/components/SBTs/sbtSelectorHelpers.ts': 1368,
  'client/src/components/SBTs/sbtPageHelpers.ts': 1316,
  'client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx': 1604,
  'client/src/components/SurveyTool/SingleQuestionResponse.tsx': 1539,
  'client/src/components/SBTs/sbtFilterHelpers.ts': 1123,
  'client/src/components/TagPage/TagPage.tsx': 1528,
  'client/src/utilities/survey/sessionResponseHydrationController.ts': 1921,
  'client/src/components/SBTs/SBTFilter.tsx': 1476,
  'client/src/components/SurveyTool/createQuestionsAndSurveysHelpers.ts': 1302,
  'client/src/components/MainContent/RiskMatrix.tsx': 1281,
  'client/src/components/SurveyTool/SurveyTool.tsx': 1266,
  'client/src/components/SurveyTool/surveyToolDraftState.ts': 1326,
  'client/src/utilities/worker/workerAuth.js': 1234,
  'client/src/utilities/session/sessionProfileScanController.ts': 1227,
  'client/src/components/Shared/AudioInput/AudioInput.tsx': 1194,
  'client/src/components/Sponsor/SponsorPage.tsx': 1300,
  'client/src/components/SBTs/createSbtGroupHelpers.ts': 1109,
  'client/src/utilities/web3/contractProfile.ts': 1152,
  'client/src/components/UserPage/userPageGateHelpers.ts': 1074,
  'client/src/utilities/web3/rpcProviders.ts': 1094,
  'client/src/components/SurveyTool/surveyResultsHelpers.ts': 1063,
  'client/src/utilities/survey/polisReportMath.js': 1062,
  'client/src/utilities/web3/contractHelpers.ts': 1020,
  'client/src/components/DemoViews/CorpusViewer.tsx': 1030,
});

const PRODUCTION_FILE_RE = /\.(?:js|jsx|ts|tsx)$/;
const TEST_OR_DECLARATION_FILE_RE = /(?:\.d|\.test|\.spec|\.testUtils|TestUtils)\.(?:js|jsx|ts|tsx)$/;
const GENERATED_OR_FIXTURE_PATH_RE = /(?:^|\/)(?:__fixtures__|__mocks__|__tests__|fixtures|generated)(?:\/|$)/;

function hasGitMetadata(rootDir = ROOT_DIR) {
  return fs.existsSync(path.join(rootDir, '.git'));
}

function listTrackedClientProductionFiles(rootDir = ROOT_DIR) {
  const output = execFileSync(
    'git',
    ['ls-files', 'client/src/components', 'client/src/utilities'],
    { cwd: rootDir, encoding: 'utf8' }
  );
  return output
    .split('\n')
    .filter(Boolean)
    .filter((relativePath) => PRODUCTION_FILE_RE.test(relativePath))
    .filter((relativePath) => !TEST_OR_DECLARATION_FILE_RE.test(relativePath))
    .filter((relativePath) => !GENERATED_OR_FIXTURE_PATH_RE.test(relativePath))
    .sort();
}

function countLines(rootDir, relativePath) {
  const text = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  return text.split(/\r?\n/).length;
}

test('large production client files stay within the explicit inventory', (t) => {
  if (!hasGitMetadata()) {
    t.skip('large-file inventory guard requires git metadata');
    return;
  }

  const failures = [];
  const currentFiles = listTrackedClientProductionFiles();
  const currentLineCounts = new Map(
    currentFiles.map((relativePath) => [relativePath, countLines(ROOT_DIR, relativePath)])
  );
  const baselineEntries = Object.entries(LARGE_CLIENT_FILE_BASELINE);
  const baselinePaths = new Set(baselineEntries.map(([relativePath]) => relativePath));

  currentLineCounts.forEach((lineCount, relativePath) => {
    if (lineCount > LARGE_FILE_LINE_LIMIT && !baselinePaths.has(relativePath)) {
      failures.push(
        `${relativePath} has ${lineCount} lines and is not in LARGE_CLIENT_FILE_BASELINE. ` +
          'Extract a helper/component/hook, or intentionally add it to the baseline with a short review rationale.'
      );
    }
  });

  baselineEntries.forEach(([relativePath, baselineLineCount]) => {
    const currentLineCount = currentLineCounts.get(relativePath);
    if (currentLineCount == null) {
      failures.push(`${relativePath} is still listed in LARGE_CLIENT_FILE_BASELINE but is no longer tracked.`);
      return;
    }
    if (currentLineCount <= LARGE_FILE_LINE_LIMIT) {
      failures.push(
        `${relativePath} is now ${currentLineCount} lines and should be removed from LARGE_CLIENT_FILE_BASELINE.`
      );
      return;
    }
    if (currentLineCount > baselineLineCount + LARGE_FILE_GROWTH_TOLERANCE) {
      failures.push(
        `${relativePath} grew from ${baselineLineCount} to ${currentLineCount} lines. ` +
          'Extract code to avoid growth, or intentionally update LARGE_CLIENT_FILE_BASELINE after review.'
      );
    }
    if (currentLineCount < baselineLineCount - LARGE_FILE_SHRINK_TOLERANCE) {
      failures.push(
        `${relativePath} shrank from ${baselineLineCount} to ${currentLineCount} lines. ` +
          'Update LARGE_CLIENT_FILE_BASELINE so future growth is measured from the new size.'
      );
    }
  });

  assert.deepEqual(failures, []);
});
