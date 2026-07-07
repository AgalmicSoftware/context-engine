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
  'client/src/components/Account/LoginAndSettingsModal.tsx': 3071,
  'client/src/components/Admin/AdminPage.tsx': 3673,
  'client/src/components/CommunityTab/CommunityTab.tsx': 2137,
  'client/src/components/DebateMap/DebateMap.tsx': 3522,
  'client/src/components/DemoViews/CorpusViewer.tsx': 1031,
  'client/src/components/DocumentLibrary/DocumentLibraryPanel.tsx': 1697,
  'client/src/components/MainContent/RiskMatrix.tsx': 1220,
  'client/src/components/MainSite/AppShell.tsx': 4093,
  'client/src/components/MainSite/mainSiteProfileScanRuntime.ts': 1366,
  'client/src/components/MainSite/mainSiteRouteRenderers.tsx': 1372,
  'client/src/components/OnePageSession/OnePageSession.tsx': 2949,
  'client/src/components/PolisReport/PolisReport.tsx': 3952,
  'client/src/components/SBTs/CreateSBTGroup.tsx': 4664,
  'client/src/components/SBTs/SBTFilter.tsx': 1398,
  'client/src/components/SBTs/SBTPage.tsx': 4510,
  'client/src/components/SBTs/SBTSelector.tsx': 2215,
  'client/src/components/SBTs/SBTsList.tsx': 3130,
  'client/src/components/SBTs/createSbtGroupHelpers.ts': 1042,
  'client/src/components/SBTs/sbtFilterHelpers.ts': 1069,
  'client/src/components/SBTs/sbtPageActionDisplayHelpers.ts': 1588,
  'client/src/components/SBTs/sbtPageHelpers.ts': 1260,
  'client/src/components/SBTs/sbtSelectorHelpers.ts': 1319,
  'client/src/components/Sessions/SessionWizard.tsx': 4571,
  'client/src/components/Shared/AudioInput/AudioInput.tsx': 1202,
  'client/src/components/Sponsor/SponsorPage.tsx': 1356,
  'client/src/components/SurveyTool/CreateQuestionsAndSurveys.tsx': 3999,
  'client/src/components/SurveyTool/QuestionFilter.tsx': 3580,
  'client/src/components/SurveyTool/SingleQuestionResponse.tsx': 1494,
  'client/src/components/SurveyTool/SurveyGenerator/SurveyGenerator.tsx': 2113,
  'client/src/components/SurveyTool/SurveyPileViewMode.tsx': 3032,
  'client/src/components/SurveyTool/SurveyQuestions.tsx': 2238,
  'client/src/components/SurveyTool/SurveyResults.tsx': 2276,
  'client/src/components/SurveyTool/SurveySelector.tsx': 2073,
  'client/src/components/SurveyTool/SurveyTool.tsx': 1264,
  'client/src/components/SurveyTool/createQuestionsAndSurveysHelpers.ts': 1238,
  'client/src/components/SurveyTool/surveyQuestionsRuntimeMethods.tsx': 9019,
  'client/src/components/SurveyTool/surveyQuestionsTypes.ts': 2312,
  'client/src/components/SurveyTool/surveyResultsHelpers.ts': 1005,
  'client/src/components/SurveyTool/surveyToolDecryptFlow.js': 1808,
  'client/src/components/SurveyTool/surveyToolDraftState.ts': 1354,
  'client/src/components/SurveyTool/surveyToolHydrationFlow.ts': 2880,
  'client/src/components/TagPage/TagPage.tsx': 1493,
  'client/src/components/UserPage/CompareAddresses.tsx': 3044,
  'client/src/components/UserPage/UserPage.tsx': 3848,
  'client/src/components/UserPage/userPageGateHelpers.ts': 1070,
  'client/src/components/UserPage/userPageHelpers.ts': 1481,
  'client/src/utilities/ai/aiClient.js': 2164,
  'client/src/utilities/arweave/arweaveClient.js': 2820,
  'client/src/utilities/crypto/cryptography.ts': 2406,
  'client/src/utilities/crypto/litProtocol.ts': 2156,
  'client/src/utilities/sbt/sessionSbtCacheController.js': 2143,
  'client/src/utilities/session/sessionProfileScanController.ts': 1197,
  'client/src/utilities/survey/polisReportMath.js': 1054,
  'client/src/utilities/survey/sessionQuestionCacheController.ts': 2156,
  'client/src/utilities/survey/sessionResponseHydrationController.ts': 1766,
  'client/src/utilities/web3/contractScripts.impl.ts': 1147,
  'client/src/utilities/web3/contractScripts.sbtRegistryMethods.ts': 1277,
  'client/src/utilities/web3/profileChainReads.ts': 1115,
  'client/src/utilities/web3/rpcDebugStats.ts': 1015,
  'client/src/utilities/web3/rpcProviders.ts': 1054,
  'client/src/utilities/web3/sessionRegistry.ts': 2540,
  'client/src/utilities/worker/workerAuth.js': 1256,
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
