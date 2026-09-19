import { normalizeResultsAnalysisSettings } from '../../../../shared/resultsAnalysisSettings.mjs';
import {
  SESSION_GENERATED_RESULTS_VIEW_KEYS,
  type SessionGeneratedResultsViewKey,
} from './sessionResultsGeneratedViewTypes';
import type {
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport/sessionResultsAnalysisArtifacts';

export type GeneratedResultsViewOption = {
  key: SessionGeneratedResultsViewKey;
  label: string;
  sourceSection: string;
};

export type GeneratedResultsSnapshotQuestion = {
  id: string;
  options?: string[];
  prompt: string;
  tags?: string[];
  type?: string;
};

export type GeneratedResultsSnapshotResponse = {
  additional?: unknown;
  answer?: unknown;
  participantId?: unknown;
  questionId?: unknown;
  questionPrompt?: unknown;
  questionType?: unknown;
};

export type GeneratedResultsControllerState = {
  adminAuthorized: boolean;
  viewerAuthorized: boolean;
  artifact: SessionResultsGeneratedAnalysisArtifact | null;
  canCheckStatus: boolean;
  canGenerate: boolean;
  coverageLabel: string;
  error: string;
  generatedAtLabel: string;
  generationMode: string;
  isRunning: boolean;
  lastGoodDraftId: string;
  lastFailure: string;
  questions: GeneratedResultsSnapshotQuestion[];
  responses: GeneratedResultsSnapshotResponse[];
  selectedView: SessionGeneratedResultsViewKey;
  status: 'idle' | 'loading' | 'ready' | 'unsupported' | 'unauthorized' | 'running' | 'error';
  statusLabel: string;
  unsupportedReason: string;
  viewOptions: GeneratedResultsViewOption[];
  viewStates: Record<string, { available: boolean; reason: string }>;
};

const VIEW_OPTIONS: GeneratedResultsViewOption[] = [
  { key: SESSION_GENERATED_RESULTS_VIEW_KEYS.CIRCLES, label: 'Circles', sourceSection: 'argumentMap' },
  { key: SESSION_GENERATED_RESULTS_VIEW_KEYS.BREAKDOWN, label: 'Breakdown', sourceSection: 'breakdown' },
  { key: SESSION_GENERATED_RESULTS_VIEW_KEYS.RISK_MATRIX, label: 'Risk Matrix', sourceSection: 'riskMatrix' },
];

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const toText = (value: unknown): string => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim());

const formatGeneratedAt = (value: unknown): string => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const readError = (value: unknown): string => {
  const record = toRecord(value);
  return toText(record.error || record.message || record.reason);
};

const normalizeSnapshotQuestion = (question: unknown, index: number): GeneratedResultsSnapshotQuestion => {
  const record = toRecord(question);
  const id = toText(record.id || record.questionId || record.questionID) || `question_${index + 1}`;
  return {
    id,
    options: toArray(record.options).map(toText).filter(Boolean),
    prompt: toText(record.prompt || record.questionPrompt || record.questionText || record.text || record.title) || id,
    tags: toArray(record.tags).map(toText).filter(Boolean),
    type: toText(record.type || record.questionType),
  };
};

const normalizeSnapshotResponse = (response: unknown): GeneratedResultsSnapshotResponse => {
  const record = toRecord(response);
  return {
    additional: record.additional ?? record.additionalComments ?? record.comments,
    answer: record.answer ?? record.value ?? record.response,
    participantId: record.participantId ?? record.participantKey,
    questionId: record.questionId ?? record.questionID ?? record.id,
    questionPrompt: record.questionPrompt,
    questionType: record.questionType,
  };
};

const buildCoverageLabel = (source: Record<string, unknown>): string => {
  const responseCount = Number(source.responseCount ?? source.responses ?? 0) || 0;
  const participantCount = Number(source.participantCount ?? source.participants ?? 0) || 0;
  const aiInputResponseCount = Number(source.aiInputResponseCount ?? responseCount) || 0;
  const aiInputQuestionCount = Number(source.aiInputQuestionCount ?? 0) || 0;
  const totalQuestionCount = Number(source.totalQuestionCount ?? 0) || 0;
  const excludedCount = Number(source.excludedCount ?? 0) || 0;
  const lockedCount = Number(source.lockedCount ?? 0) || 0;
  const parts = [
    `${responseCount} response${responseCount === 1 ? '' : 's'} from ${participantCount} distinct participant${participantCount === 1 ? '' : 's'}`,
  ];
  if (aiInputResponseCount && aiInputResponseCount !== responseCount) {
    parts.push(`AI input used ${aiInputResponseCount} response${aiInputResponseCount === 1 ? '' : 's'}`);
  }
  if (aiInputQuestionCount && totalQuestionCount) {
    parts.push(`${aiInputQuestionCount}/${totalQuestionCount} questions included`);
  }
  if (excludedCount > 0) {
    parts.push(`${excludedCount} excluded`);
  }
  if (lockedCount > 0) {
    parts.push(`${lockedCount} locked row${lockedCount === 1 ? '' : 's'} skipped`);
  }
  return parts.join('; ');
};

export const buildInitialGeneratedResultsControllerState = (): GeneratedResultsControllerState => ({
  adminAuthorized: false,
  viewerAuthorized: false,
  artifact: null,
  canCheckStatus: false,
  canGenerate: false,
  coverageLabel: '',
  error: '',
  generatedAtLabel: '',
  generationMode: 'manual',
  isRunning: false,
  lastFailure: '',
  lastGoodDraftId: '',
  questions: [],
  responses: [],
  selectedView: SESSION_GENERATED_RESULTS_VIEW_KEYS.CIRCLES,
  status: 'idle',
  statusLabel: 'Generated AI views are not loaded.',
  unsupportedReason: '',
  viewOptions: [],
  viewStates: {},
});


export const shouldOfferGeneratedResultsAuthorization = ({
  account,
  sessionConfig,
}: {
  account?: unknown;
  sessionConfig?: unknown;
} = {}): boolean => {
  const config = toRecord(sessionConfig);
  const accountLower = toText(account).toLowerCase();
  const adminAddress = toText(config.adminAddress || toRecord(config.__registry).adminAddress).toLowerCase();
  const hasHatAuthority = !!toText(config.adminHatId) && !!toText(config.hatsAddress);
  if (!accountLower) return false;
  return hasHatAuthority || (!!adminAddress && adminAddress === accountLower);
};

export const resolveGeneratedResultsControllerState = ({
  previousSelectedView,
  statusBody,
}: {
  previousSelectedView?: unknown;
  statusBody?: unknown;
} = {}): GeneratedResultsControllerState => {
  const body = toRecord(statusBody);
  const adminAuthorized = body.adminAuthorized === true;
  const viewerAuthorized = adminAuthorized || body.viewerAuthorized === true;
  const ok = body.ok !== false && viewerAuthorized;
  const base = buildInitialGeneratedResultsControllerState();
  if (body.unsupported === true) {
    return { ...base, status: 'unsupported', unsupportedReason: readError(body), statusLabel: readError(body) };
  }
  if (!ok) {
    const error = readError(body);
    return {
      ...base,
      error,
      status: Number(body.status) === 403 ? 'unauthorized' : error ? 'error' : 'loading',
      statusLabel: error || 'Checking generated AI views…',
    };
  }

  const settings = normalizeResultsAnalysisSettings(body.settings);
  const capability = toRecord(body.capability);
  const state = toRecord(body.state);
  const jobState = toText(state.jobState || 'idle');
  const lastGood = toRecord(state.lastGood);
  const source = toRecord(lastGood.source);
  const snapshot = toRecord(lastGood.snapshot);
  const artifact = (toRecord(lastGood.artifact).kind ? lastGood.artifact : null) as SessionResultsGeneratedAnalysisArtifact | null;
  const viewOptions = VIEW_OPTIONS.filter((option) => settings.views[option.key as keyof typeof settings.views] === true);
  const viewStates = VIEW_OPTIONS.reduce<Record<string, { available: boolean; reason: string }>>((acc, option) => {
    const section = toRecord(artifact?.sections?.[option.sourceSection as keyof SessionResultsGeneratedAnalysisArtifact['sections']]);
    acc[option.key] = {
      available: section.available === true,
      reason: toText(section.reason),
    };
    return acc;
  }, {});
  const previous = toText(previousSelectedView) as SessionGeneratedResultsViewKey;
  const selectedView = viewOptions.some((option) => option.key === previous)
    ? previous
    : viewOptions[0]?.key || SESSION_GENERATED_RESULTS_VIEW_KEYS.CIRCLES;
  const manualMode = settings.generationMode === 'manual' || settings.generationMode === 'both';
  const manualCapability = toRecord(capability.manual);
  const lastFailure = readError(state.lastFailure);
  const pollExpired = body.pollExpired === true;
  const active = toRecord(state.active);
  const hasActiveJob = jobState === 'running' || jobState === 'queued' || !!active.attemptId || !!active.requestId;
  const canRetryAutomaticFailure = !!lastFailure && settings.generationMode === 'automatic';
  const canCheckStatus = viewerAuthorized && pollExpired;
  const canGenerate = adminAuthorized && !canCheckStatus && !hasActiveJob && (manualMode || canRetryAutomaticFailure) && manualCapability.supported !== false;
  const isRunning = hasActiveJob && !pollExpired;
  const generatedAtLabel = formatGeneratedAt(lastGood.generatedAt || artifact?.generatedAt);
  const coverageLabel = buildCoverageLabel(source);

  return {
    ...base,
    adminAuthorized,
    viewerAuthorized,
    artifact,
    canCheckStatus,
    canGenerate,
    coverageLabel,
    error: '',
    generatedAtLabel,
    generationMode: settings.generationMode,
    isRunning,
    lastFailure,
    lastGoodDraftId: toText(lastGood.draftId),
    questions: toArray(snapshot.questions).map(normalizeSnapshotQuestion),
    responses: toArray(snapshot.responses).map(normalizeSnapshotResponse),
    selectedView,
    status: isRunning ? 'running' : 'ready',
    statusLabel: canCheckStatus
      ? 'Generated AI views are still being prepared. Check again for the latest status.'
      : isRunning
        ? artifact
          ? `Latest generated view remains visible while refresh is running${generatedAtLabel ? ` ${generatedAtLabel}` : ''}. ${coverageLabel}`.trim()
          : 'Generated AI views are being prepared.'
        : artifact
          ? `Latest generated view visible${generatedAtLabel ? ` ${generatedAtLabel}` : ''}. ${coverageLabel}`.trim()
          : adminAuthorized && canGenerate
            ? 'No generated view yet.'
            : 'No generated view is available yet.',
    unsupportedReason: adminAuthorized && !canGenerate && !canCheckStatus ? readError(manualCapability) || 'Manual generated views are disabled for this session.' : '',
    viewOptions,
    viewStates,
  };
};
