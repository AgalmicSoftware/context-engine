import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import {
  buildSessionResultsAnalysisAiPayload,
  buildSessionResultsAnalysisInputSignature,
  evaluateSessionResultsAnalysisEligibility,
  SESSION_RESULTS_ANALYSIS_SECTION_KEYS,
  shortenSessionResultsAddress,
  type SessionResultsAnalysisSectionKey,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import { SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS as DEFAULT_HTML_REPORT_SELECTED_SECTIONS } from './surveyResultsHtmlReportSelection.js';
import type { SurveyResultsHtmlReportSectionKey } from './surveyResultsHtmlReportReadiness.js';
import { buildSurveyResultsDemoAnalysisArtifact } from './surveyResultsDemoAnalysisArtifact.js';
import {
  buildSurveyResultsAnalysisResponsesForExport,
  buildSurveyResultsAnalysisSegmentDimensionsForExport,
  readSurveyResultsAnalysisSafeLabel,
} from './surveyResultsAnalysisDataModel';
import {
  buildSurveyResultsHtmlReportParticipantCount,
  buildSurveyResultsHtmlReportQuestionsForExport,
  buildSurveyResultsHtmlReportResponseCountsByQuestion,
} from './surveyResultsHtmlReportDataModel';
import { buildSurveyResultsHtmlReportSnapshot } from './surveyResultsHtmlReportSnapshotDataModel';
import {
  buildSurveyResultsAnalysisArtifactWritePlan,
  buildSurveyResultsAnalysisArtifactWriteReadinessPlan,
} from './surveyResultsCacheWriteEligibilityPlan';
import {
  buildSurveyResultsAnalysisArtifactCacheKey,
  buildSurveyResultsAnalysisArtifactCacheReadRequestPlan,
  type SurveyResultsAnalysisArtifactCacheReadPort,
  type SurveyResultsAnalysisArtifactCacheWritePort,
} from './surveyResultsAnalysisArtifactCachePorts';
import { runSurveyResultsAnalysisArtifactReadController } from './surveyResultsAnalysisArtifactReadController';
import { runSurveyResultsAnalysisArtifactWriteController } from './surveyResultsAnalysisArtifactWriteController';
import type { SurveyResultsGateRecord, SurveyResultsResponseRecord } from './surveyResultsLockedFieldHelpers';
import type { SurveyResultsQuestionExportRecord } from './surveyResultsExportRows';

type SurveyResultsHtmlReportRecord = Record<string, unknown>;

export type SurveyResultsHtmlReportState = SurveyResultsHtmlReportRecord & {
  filterState?: unknown;
  filteredQuestionsCount?: unknown;
  filteredResponsesCount?: unknown;
  htmlReportAnalysisArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  htmlReportDemoMode?: unknown;
  htmlReportSelectedSections?: Partial<SessionResultsSectionSelection> | null;
  networkLatestBlock?: unknown;
  sbtFilteredAggregatorQuestionResponses?: unknown;
  sbtFilteredResponses?: unknown;
  surveyId?: unknown;
  surveyTitle?: unknown;
  surveyViewMode?: unknown;
  totalQuestionsCount?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsHtmlReportProps = SurveyResultsHtmlReportRecord & {
  account?: unknown;
  activeSessionSlug?: unknown;
  loginComplete?: unknown;
  network?: unknown;
  sessionName?: unknown;
  sessionSlug?: unknown;
};

export type SurveyResultsHtmlReportSbtDisplayLabelResolver = (args: {
  address: string;
  chainId?: unknown;
  fallback?: string;
  preferredSlug?: unknown;
}) => string;

export type SurveyResultsHtmlReportAnalysisPayloadForAi = ReturnType<typeof buildSessionResultsAnalysisAiPayload> & {
  eligibility: ReturnType<typeof evaluateSessionResultsAnalysisEligibility>;
  inputSignature: string;
};

export type SurveyResultsHtmlReportExporterMetadata = {
  address: string;
  chainId: number | null;
  displayAddress: string;
};

export type SurveyResultsHtmlReportRuntime = {
  buildHtmlReportDemoAnalysisArtifact: () => SessionResultsGeneratedAnalysisArtifact;
  buildSessionResultsAnalysisPayloadForAi: () => SurveyResultsHtmlReportAnalysisPayloadForAi;
  buildSessionResultsHtmlReportSnapshot: (exportedAt?: unknown) => SessionResultsHtmlSnapshot;
  getHtmlReportAnalysisArtifact: () => SessionResultsGeneratedAnalysisArtifact | null;
  getHtmlReportAnalysisSectionsToGenerate: (
    sections?: Required<SessionResultsSectionSelection>,
  ) => SessionResultsAnalysisSectionKey[];
  getHtmlReportChainId: () => number | null;
  getHtmlReportExporterMetadata: () => SurveyResultsHtmlReportExporterMetadata | null;
  getHtmlReportNetworkLabel: () => string;
  getHtmlReportSelectedSections: () => Required<SessionResultsSectionSelection>;
  getSessionResultsAnalysisCacheKey: (inputSignature: unknown) => string;
  getSessionResultsAnalysisCacheSlug: () => string;
  isHtmlReportDemoModeActive: () => boolean;
  isHtmlReportDemoSession: () => boolean;
  isHtmlReportExportAuthorized: () => boolean;
  readSessionResultsAnalysisArtifactFromCache: (
    inputSignature: unknown,
  ) => SessionResultsGeneratedAnalysisArtifact | null;
  writeSessionResultsAnalysisArtifactToCache: (
    artifact: SessionResultsGeneratedAnalysisArtifact | null,
  ) => Promise<void>;
};

export type SurveyResultsHtmlReportRuntimeArgs = {
  getEffectiveSlug: () => string;
  getFilteredQuestionsForExport: () => SurveyResultsQuestionExportRecord[];
  getNetworkQuestionsForCurrentContext: () => unknown;
  getProps: () => SurveyResultsHtmlReportProps;
  getQuestionEncryptionGates: (question: SurveyResultsHtmlReportRecord) => SurveyResultsGateRecord[];
  getResponseQuestionId: (response: SurveyResultsResponseRecord | null | undefined) => string;
  getResponseQuestionPrompt: (
    response: SurveyResultsResponseRecord | null | undefined,
    questionData?: SurveyResultsHtmlReportRecord | null,
  ) => unknown;
  getResponseQuestionType: (
    response: SurveyResultsResponseRecord | null | undefined,
    questionData?: SurveyResultsHtmlReportRecord | null,
  ) => unknown;
  getState: () => SurveyResultsHtmlReportState;
  normalizeGateSbtEntries: (gate: SurveyResultsGateRecord) => Array<{ address?: unknown; label?: unknown }>;
  nowIso?: () => string;
  parseResponse: (response: unknown) => unknown;
  readAnalysisCache: (slug: string) => Promise<unknown>;
  readAnalysisCacheSync: SurveyResultsAnalysisArtifactCacheReadPort;
  resolveSbtDisplayLabel: SurveyResultsHtmlReportSbtDisplayLabelResolver;
  writeAnalysisArtifact: SurveyResultsAnalysisArtifactCacheWritePort;
};

const HTML_REPORT_SECTION_TO_ANALYSIS_SECTION: Partial<
  Record<SurveyResultsHtmlReportSectionKey, SessionResultsAnalysisSectionKey>
> = {
  argumentMap: 'argumentMap',
  atlas: 'atlas',
  report: 'breakdown',
  riskMatrix: 'riskMatrix',
};

const toRecord = (value: unknown): SurveyResultsHtmlReportRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsHtmlReportRecord) : {};

export const createSurveyResultsHtmlReportRuntime = ({
  getEffectiveSlug,
  getFilteredQuestionsForExport,
  getNetworkQuestionsForCurrentContext,
  getProps,
  getQuestionEncryptionGates,
  getResponseQuestionId,
  getResponseQuestionPrompt,
  getResponseQuestionType,
  getState,
  normalizeGateSbtEntries,
  nowIso = () => new Date().toISOString(),
  parseResponse,
  readAnalysisCache,
  readAnalysisCacheSync,
  resolveSbtDisplayLabel,
  writeAnalysisArtifact,
}: SurveyResultsHtmlReportRuntimeArgs): SurveyResultsHtmlReportRuntime => {
  const getHtmlReportChainId = (): number | null => {
    const network = toRecord(getProps().network);
    const chainId = Number(network.id ?? network.chainId);
    return Number.isFinite(chainId) ? chainId : null;
  };

  const getHtmlReportNetworkLabel = (): string => {
    const network = toRecord(getProps().network);
    const chainId = getHtmlReportChainId();
    const explicitLabel = String(network.name || network.label || network.network || '').trim();
    if (explicitLabel) return explicitLabel;
    if (chainId === 11155420) return 'OP Sepolia';
    if (chainId === 84532) return 'Base Sepolia';
    return chainId ? `Chain ${chainId}` : '';
  };

  const getHtmlReportResponseCountsByQuestion = (): Map<string, number> => {
    const state = getState();
    return buildSurveyResultsHtmlReportResponseCountsByQuestion({
      aggregatorQuestionResponses: state.sbtFilteredAggregatorQuestionResponses,
      filteredResponses: state.sbtFilteredResponses,
      getResponseQuestionId: (answer) => getResponseQuestionId(toRecord(answer) as SurveyResultsResponseRecord),
      parseResponse,
      surveyViewMode: state.surveyViewMode,
      viewMode: state.viewMode,
    });
  };

  const getHtmlReportParticipantCount = (): number => {
    const state = getState();
    return buildSurveyResultsHtmlReportParticipantCount({
      aggregatorQuestionResponses: state.sbtFilteredAggregatorQuestionResponses,
      filteredResponses: state.sbtFilteredResponses,
      surveyViewMode: state.surveyViewMode,
      viewMode: state.viewMode,
    });
  };

  const getHtmlReportQuestionsForExport = () =>
    buildSurveyResultsHtmlReportQuestionsForExport({
      filteredQuestions: getFilteredQuestionsForExport(),
      responseCountsByQuestion: getHtmlReportResponseCountsByQuestion(),
    });

  const isHtmlReportDemoSession = (): boolean => {
    const props = getProps();
    const state = getState();
    const candidates = [getEffectiveSlug(), props.sessionSlug, props.activeSessionSlug, state.surveyTitle].map(
      (value) =>
        String(value || '')
          .trim()
          .toLowerCase(),
    );
    return candidates.some((value) => isDemoSessionSlug(value));
  };

  const isHtmlReportDemoModeActive = (): boolean => isHtmlReportDemoSession() && !!getState().htmlReportDemoMode;

  const getHtmlReportExporterMetadata = (): SurveyResultsHtmlReportExporterMetadata | null => {
    const props = getProps();
    if (isHtmlReportDemoModeActive()) {
      return {
        address: 'demo-preview',
        chainId: getHtmlReportChainId(),
        displayAddress: 'Demo preview',
      };
    }
    const account = String(props.account || '').trim();
    if (!props.loginComplete || !account) return null;
    return {
      address: account,
      chainId: getHtmlReportChainId(),
      displayAddress: shortenSessionResultsAddress(account),
    };
  };

  const isHtmlReportExportAuthorized = (): boolean => !!getHtmlReportExporterMetadata();

  const getHtmlReportSelectedSections = (): Required<SessionResultsSectionSelection> => ({
    ...DEFAULT_HTML_REPORT_SELECTED_SECTIONS,
    ...(getState().htmlReportSelectedSections || {}),
  });

  const getHtmlReportAnalysisArtifact = (): SessionResultsGeneratedAnalysisArtifact | null => {
    const artifact = getState().htmlReportAnalysisArtifact || null;
    return artifact && artifact.kind ? artifact : null;
  };

  const buildSessionResultsAnalysisPayloadForAi = (): SurveyResultsHtmlReportAnalysisPayloadForAi => {
    const state = getState();
    const props = getProps();
    const sessionSlug = getEffectiveSlug() || '';
    const sessionName = String(props.sessionName || state.surveyTitle || sessionSlug || 'Session').trim();
    const built = buildSessionResultsAnalysisAiPayload({
      questions: getHtmlReportQuestionsForExport(),
      responses: buildSurveyResultsAnalysisResponsesForExport({
        aggregatorQuestionResponses: state.sbtFilteredAggregatorQuestionResponses,
        filteredResponses: state.sbtFilteredResponses,
        getResponseQuestionId: (response) => getResponseQuestionId(toRecord(response) as SurveyResultsResponseRecord),
        getResponseQuestionPrompt: (response, questionData) =>
          getResponseQuestionPrompt(toRecord(response) as SurveyResultsResponseRecord, toRecord(questionData)),
        getResponseQuestionType: (response, questionData) =>
          getResponseQuestionType(toRecord(response) as SurveyResultsResponseRecord, toRecord(questionData)),
        networkQuestions: getNetworkQuestionsForCurrentContext(),
        parseResponse,
        surveyViewMode: state.surveyViewMode,
        viewMode: state.viewMode,
      }),
      segmentDimensions: buildSurveyResultsAnalysisSegmentDimensionsForExport({
        filterState: state.filterState,
        getQuestionEncryptionGates: (question) => getQuestionEncryptionGates(toRecord(question)),
        getSbtEntryLabel: (entry) => {
          const record = toRecord(entry);
          const direct = readSurveyResultsAnalysisSafeLabel(
            record.label || record.name || record.title || record.sessionName || record.group || record.slug,
          );
          if (direct) return direct;
          const address = String(
            record.address || record.sbtAddress || (typeof entry === 'string' ? entry : '') || '',
          ).trim();
          if (!address) return '';
          const resolved = resolveSbtDisplayLabel({
            address,
            chainId: getHtmlReportChainId(),
            fallback: 'short',
            preferredSlug: getEffectiveSlug() || '',
          });
          return readSurveyResultsAnalysisSafeLabel(resolved);
        },
        networkQuestions: getNetworkQuestionsForCurrentContext(),
        normalizeGateSbtEntries: (gate) => normalizeGateSbtEntries(toRecord(gate) as SurveyResultsGateRecord),
        participantCount: getHtmlReportParticipantCount(),
        questions: getHtmlReportQuestionsForExport(),
      }),
      session: {
        name: sessionName,
        slug: sessionSlug,
      },
    });
    return {
      ...built,
      eligibility: evaluateSessionResultsAnalysisEligibility(built.aiPayload),
      inputSignature: buildSessionResultsAnalysisInputSignature(built.aiPayload),
    };
  };

  const buildHtmlReportDemoAnalysisArtifact = (): SessionResultsGeneratedAnalysisArtifact => {
    const built = buildSessionResultsAnalysisPayloadForAi();
    return buildSurveyResultsDemoAnalysisArtifact({
      analysisPayload: built,
      generatedAt: nowIso(),
      inputSignature: built.inputSignature,
    });
  };

  const buildSessionResultsHtmlReportSnapshot = (exportedAt: unknown = nowIso()): SessionResultsHtmlSnapshot => {
    const state = getState();
    const props = getProps();
    const sessionSlug = getEffectiveSlug() || '';
    const sessionName = String(props.sessionName || state.surveyTitle || sessionSlug || 'Session').trim();
    return buildSurveyResultsHtmlReportSnapshot({
      analysisArtifact: getHtmlReportAnalysisArtifact(),
      chainId: getHtmlReportChainId(),
      countsByQuestion: getHtmlReportResponseCountsByQuestion(),
      exportedAt,
      exporterMetadata: getHtmlReportExporterMetadata(),
      filterState: state.filterState,
      filteredQuestionsCount: state.filteredQuestionsCount,
      filteredResponsesCount: state.filteredResponsesCount,
      latestKnownBlock: state.networkLatestBlock,
      networkLabel: getHtmlReportNetworkLabel(),
      participantCount: getHtmlReportParticipantCount(),
      questions: getHtmlReportQuestionsForExport(),
      sessionName,
      sessionSlug,
      surveyId: state.surveyId,
      surveyTitle: state.surveyTitle,
      surveyViewMode: state.surveyViewMode,
      totalQuestionsCount: state.totalQuestionsCount,
      totalResponsesCount: state.totalResponsesCount,
      viewMode: state.viewMode,
    });
  };

  const getHtmlReportAnalysisSectionsToGenerate = (
    sections: Required<SessionResultsSectionSelection> = getHtmlReportSelectedSections(),
  ): SessionResultsAnalysisSectionKey[] => {
    const keys = new Set<SessionResultsAnalysisSectionKey>();
    Object.entries(sections).forEach(([sectionKey, selected]) => {
      if (!selected) return;
      const analysisKey = HTML_REPORT_SECTION_TO_ANALYSIS_SECTION[sectionKey as SurveyResultsHtmlReportSectionKey];
      if (analysisKey) keys.add(analysisKey);
    });
    return SESSION_RESULTS_ANALYSIS_SECTION_KEYS.filter((key) => keys.has(key));
  };

  const getSessionResultsAnalysisCacheSlug = (): string => getEffectiveSlug() || 'general';

  const getSessionResultsAnalysisCacheKey = (inputSignature: unknown): string =>
    buildSurveyResultsAnalysisArtifactCacheKey({
      chainId: getHtmlReportChainId(),
      inputSignature,
      networkLabel: getHtmlReportNetworkLabel(),
    });

  const readSessionResultsAnalysisArtifactFromCache = (
    inputSignature: unknown,
  ): SessionResultsGeneratedAnalysisArtifact | null => {
    const cacheKey = getSessionResultsAnalysisCacheKey(inputSignature);
    const readPlan = buildSurveyResultsAnalysisArtifactCacheReadRequestPlan({
      cacheKey,
      inputSignature,
      slug: getSessionResultsAnalysisCacheSlug(),
    });
    const readResult = runSurveyResultsAnalysisArtifactReadController({
      ports: {
        readAnalysisArtifactCache: readAnalysisCacheSync,
      },
      readRequest: readPlan.shouldRead ? readPlan.readRequest : null,
      target: readPlan.target,
    });
    return readResult.artifact;
  };

  const writeSessionResultsAnalysisArtifactToCache = async (
    artifact: SessionResultsGeneratedAnalysisArtifact | null,
  ): Promise<void> => {
    const slug = getSessionResultsAnalysisCacheSlug();
    const cacheKey = artifact ? getSessionResultsAnalysisCacheKey(artifact.inputSignature) : '';
    const writeReadinessPlan = buildSurveyResultsAnalysisArtifactWriteReadinessPlan({
      artifact,
      cacheKey,
      inputSignature: artifact?.inputSignature || '',
      slug,
    });
    if (!writeReadinessPlan.shouldReadCache) return;
    const current = toRecord(await readAnalysisCache(slug));
    const writePlan = buildSurveyResultsAnalysisArtifactWritePlan({
      artifact,
      cacheKey,
      currentCache: current,
      inputSignature: artifact?.inputSignature || '',
      slug,
    });
    if (!writePlan.shouldWrite || !writePlan.payload) return;
    const writeResult = await runSurveyResultsAnalysisArtifactWriteController({
      plan: writePlan,
      ports: {
        writeAnalysisArtifact,
      },
    });
    if (!writeResult.ok && writeResult.error) throw writeResult.error;
  };

  return {
    buildHtmlReportDemoAnalysisArtifact,
    buildSessionResultsAnalysisPayloadForAi,
    buildSessionResultsHtmlReportSnapshot,
    getHtmlReportAnalysisArtifact,
    getHtmlReportAnalysisSectionsToGenerate,
    getHtmlReportChainId,
    getHtmlReportExporterMetadata,
    getHtmlReportNetworkLabel,
    getHtmlReportSelectedSections,
    getSessionResultsAnalysisCacheKey,
    getSessionResultsAnalysisCacheSlug,
    isHtmlReportDemoModeActive,
    isHtmlReportDemoSession,
    isHtmlReportExportAuthorized,
    readSessionResultsAnalysisArtifactFromCache,
    writeSessionResultsAnalysisArtifactToCache,
  };
};
