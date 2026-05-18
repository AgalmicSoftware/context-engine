const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '../..');

const EXPECTED_JS_TO_TS_REEXPORT_BARRELS = [
  'actions/accountActions.js',
  'actions/sessionStateActions.js',
  'actions/types.js',
  'components/ContractPage/contractMetadata.js',
  'components/ContractPage/contractPageSessionResolution.js',
  'components/ContractPage/contractSourceLoader.js',
  'components/MainContent/welcomeSlides.js',
  'components/MainSite/cacheConstants.js',
  'components/MainSite/debugTelemetry.js',
  'components/MainSite/litSessionConfig.js',
  'components/MainSite/mainSiteUtils.js',
  'components/MainSite/progressHelpers.js',
  'components/MainSite/reloadWindowLocation.js',
  'components/MainSite/routeConfig.js',
  'components/MainSite/routeLazyComponents.js',
  'components/MainSite/routeStyles.js',
  'components/MainSite/storageEviction.js',
  'components/MainSite/urlUtils.js',
  'components/Onboarding/onboardingConfig.js',
  'components/SBTs/sbtSelectorSessionResolution.js',
  'components/SBTs/sbtSessionUniverse.js',
  'components/Sessions/cloudflareTokenTemplate.js',
  'components/Sessions/sessionWizardContracts.js',
  'components/Sessions/sessionWizardDraftCache.js',
  'components/Shared/compactImageClipboard.js',
  'components/SurveyTool/surveyToolCacheState.js',
  'components/SurveyTool/surveyToolDraftState.js',
  'components/SurveyTool/surveyToolNavigation.js',
  'components/SurveyTool/surveyToolResponseMerge.js',
  'components/SurveyTool/surveyToolResponseState.js',
  'components/SurveyTool/surveyToolRuntimeSupport.js',
  'components/SurveyTool/surveyToolScope.js',
  'components/SurveyTool/surveyToolSignatures.js',
  'components/SurveyTool/surveyToolSliderState.js',
  'components/SurveyTool/surveyToolSlugLookup.js',
  'components/SurveyTool/surveyToolViewState.js',
  'prompts/aiRewritePrompt.js',
  'prompts/audioSummaryPrompt.js',
  'prompts/clusterAnalysisPrompt.js',
  'prompts/compareToolkitPrompt.js',
  'prompts/photoAnalysisPrompt.js',
  'prompts/questionSelectionPrompt.js',
  'prompts/rankQuestionsPrompt.js',
  'prompts/seedGenPrompt.js',
  'prompts/tagInterpretationPrompt.js',
  'prompts/userAnalysisPrompt.js',
  'reducers/accountReducer.js',
  'reducers/index.js',
  'reducers/sessionStateReducer.js',
  'utilities/arweave/arweaveDownload.js',
  'utilities/arweave/arweaveFailureClassifiers.js',
  'utilities/arweave/arweaveMetadataFailureLog.js',
  'utilities/arweave/arweaveRetryHelpers.js',
  'utilities/arweave/arweaveUploadHelpers.js',
  'utilities/arweave/arweaveUrls.js',
  'utilities/arweave/noLeakPayloads.js',
  'utilities/arweave/publishUploadAuth.js',
  'utilities/arweave/sponsoredBundles.js',
  'utilities/cache/cacheUpdateCoalescer.js',
  'utilities/cache/mainSiteDgStorage.js',
  'utilities/cache/sessionCachePersistenceController.js',
  'utilities/cache/sessionCacheReadinessController.js',
  'utilities/cache/storageJson.js',
  'utilities/ceAgentContract.js',
  'utilities/defaultTags.js',
  'utilities/demo/demoAnalysisAdapter.js',
  'utilities/demo/demoAnalysisMath.js',
  'utilities/demo/demoCorpusRecords.js',
  'utilities/demoModeHelpers.js',
  'utilities/docLibrary/tags.js',
  'utilities/logging.js',
  'utilities/sbt/sbtCacheEntryHelpers.js',
  'utilities/sbt/sbtCountHelpers.js',
  'utilities/sbt/sbtCreateFormCache.js',
  'utilities/sbt/sbtDetailPath.js',
  'utilities/sbt/sbtFullScanPolicy.js',
  'utilities/sbt/sbtHistoryHelpers.js',
  'utilities/sbt/sbtInstanceListenersMode.js',
  'utilities/sbt/sbtPasswordRecoveryStore.js',
  'utilities/sbt/sbtRealtimeCursorHelpers.js',
  'utilities/sbt/sessionFeaturedSBTs.js',
  'utilities/session/mainSiteSessionConfig.js',
  'utilities/session/mainSiteSessionScanPolicy.js',
  'utilities/session/sessionMetaController.js',
  'utilities/session/sessionProfileScanController.js',
  'utilities/session/sessionQuestionDecryption.js',
  'utilities/shared/primitives.js',
  'utilities/state/composeEnhancers.js',
  'utilities/survey/filterStateUtils.js',
  'utilities/survey/freeformAnswerUtils.js',
  'utilities/survey/questionResponsesWatermark.js',
  'utilities/survey/questionRouting.js',
  'utilities/survey/questionTags.js',
  'utilities/survey/ratingValue.js',
  'utilities/survey/sessionQuestionCacheController.js',
  'utilities/survey/sessionResponseHydrationController.js',
  'utilities/survey/sessionSurveyCacheController.js',
  'utilities/ui/blockieAvatars.js',
  'utilities/ui/demoAvatars.js',
  'utilities/ui/historicalFigureAvatars.js',
  'utilities/ui/imageScripts.js',
  'utilities/ui/jsonFunctions.js',
  'utilities/ui/notify.js',
  'utilities/ui/publicPageHead.js',
  'utilities/ui/publicUrl.js',
  'utilities/ui/terminology.js',
  'utilities/ui/toastBus.js',
  'utilities/ui/toastTheme.js',
  'utilities/ui/uiPerfStats.js',
  'utilities/urlUtils.js',
  'utilities/worker/corsProxy.js',
  'utilities/worker/workerCorsOrigins.js',
  'utilities/worker/workerSessionResolution.js',
  'utilities/worker/workerUrl.js',
  'variables/arweaveGateways.js',
  'variables/demo/historical_figure_demographics.js',
  'variables/demo/index.js',
  'variables/publicDeploymentConfig.js',
  'variables/publicEnv.js',
  'variables/publicRepoMetadata.js',
  'variables/rpcEndpoints.js',
];

const toPosixPath = (filePath) => filePath.split(path.sep).join('/');

const stripComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .trim();

const normalizeForComparison = (source) => source
  .replace(/;\s*/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const isJsToTsReexportBarrel = (filePath) => {
  const source = stripComments(fs.readFileSync(filePath, 'utf8'));
  if (!source) return false;

  const reexportPattern =
    /export\s+(?:\{[\s\S]*?\}|\*|\{\s*default\s*\})\s+from\s+['"]\.\/(.+?)\.(ts|tsx)['"]/g;
  const matches = [];
  let match = reexportPattern.exec(source);
  while (match) {
    matches.push(match[0]);
    match = reexportPattern.exec(source);
  }

  return matches.length > 0
    && normalizeForComparison(source) === normalizeForComparison(matches.join(''));
};

const collectJsFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const filePath = path.join(dir, entry.name);
  if (entry.isDirectory()) return collectJsFiles(filePath);
  return entry.isFile() && entry.name.endsWith('.js') ? [filePath] : [];
});

describe('transitional re-export inventory', () => {
  it('keeps PRD 512 js-to-ts compatibility barrels explicit', () => {
    const discovered = collectJsFiles(SRC_ROOT)
      .filter(isJsToTsReexportBarrel)
      .map((filePath) => toPosixPath(path.relative(SRC_ROOT, filePath)))
      .sort();

    expect(discovered).toEqual(EXPECTED_JS_TO_TS_REEXPORT_BARRELS);
  });
});
