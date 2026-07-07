import type React from 'react';

import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsLockedResponsesDecryptCompletePatch,
  buildSurveyResultsLockedResponsesDecryptingPatch,
  toggleSurveyResultsLockedResponseDetailsPatch,
} from './surveyResultsHelpers.js';
import { buildSurveyResultsLockedGateDetails } from './surveyResultsLockedGateDetailsModel';
import { buildSurveyResultsLockedRows } from './surveyResultsLockedResponsesModel';
import {
  buildLockedResponseSignature,
  extractEnvelopeCandidate,
  hasOwn,
  isBannerEligibleLockedField,
  isLockedEncryptedField,
  normalizeGateSbtEntries,
  normalizeGateText,
  type SurveyResultsEncryptedFieldRecord,
  type SurveyResultsGateRecord,
  type SurveyResultsResponseRecord,
} from './surveyResultsLockedFieldHelpers';
import type { CryptoGateDecryptOptions } from '../../domains/crypto/cryptoGatePort';
import type { SurveyResultsProps, SurveyResultsState } from './SurveyResults';

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsQuestionEncryptionRecord = SurveyResultsRecord & {
  enabled?: unknown;
  gate?: unknown;
  gates?: unknown;
};

type SurveyResultsQuestionWithEncryption = SurveyResultsRecord & {
  encryption?: SurveyResultsQuestionEncryptionRecord | unknown;
};

type SurveyResultsSessionConfigRecord = SurveyResultsRecord & {
  __registry?: SurveyResultsRecord & { chainId?: unknown };
  networkChainId?: number | string | null;
  sponsored?: SurveyResultsRecord & { gates?: unknown };
};

type SurveyResultsLockedGateDetail = {
  address: string;
  href: string;
  label: React.ReactNode;
};

type SurveyResultsLockedRow = SurveyResultsRecord & {
  key: string;
  mergedResponse?: SurveyResultsResponseRecord | null;
  questionId: string;
  responder: string;
  response?: SurveyResultsResponseRecord | null;
  surveyId?: unknown;
};

type SurveyResultsLockedResponsesModel = SurveyResultsRecord & {
  gateDetails?: SurveyResultsLockedGateDetail[];
  hasGenericGateMessage?: boolean;
  lockedCount?: number;
  lockedRows?: SurveyResultsLockedRow[];
};

type SurveyResultsLockedGateContext = {
  configuredGateMap: Record<string, SurveyResultsGateRecord>;
  defaultPolicy: SurveyResultsRecord & { gates?: unknown };
  fallbackChainId: number | null;
  slug: string;
};

type SurveyResultsLockedGateDetailsResult = {
  gateDetails: SurveyResultsLockedGateDetail[];
  hasGenericGateMessage: boolean;
};

type SurveyResultsLockedResponsesModelMemo = {
  aggregatorRef?: unknown;
  overridesRef?: unknown;
  questionLookupRef?: unknown;
  responsesRef?: unknown;
  result?: SurveyResultsLockedResponsesModel;
  slug?: string;
  surveyViewMode?: unknown;
  viewMode?: unknown;
};

type SurveyResultsDecryptFieldResult = { ok: true; value: unknown } | { ok: false; error?: unknown };

type SurveyResultsLitHooks = SurveyResultsRecord & {
  getKey?: (...args: unknown[]) => unknown;
};

type SurveyResultsWindowWithLitHooks = Window & {
  __litHooks?: SurveyResultsLitHooks | null;
  litHooks?: SurveyResultsLitHooks | null;
};

type SurveyResultsDecryptedResponseOverride = SurveyResultsRecord & {
  additionalValue?: unknown;
  answerValue?: unknown;
  conviction?: unknown;
  importance?: unknown;
};

type SurveyResultsLockedResponseKeyArgs = {
  questionId?: unknown;
  responder?: unknown;
  response?: SurveyResultsResponseRecord | null;
  surveyId?: unknown;
};
type SurveyResultsSbtDisplayLabelResolver = (args: {
  address: string;
  chainId?: unknown;
  fallback?: string;
  preferredSlug?: unknown;
}) => string;

export type SurveyResultsLockedResponsesRuntimeInstance = {
  _lockedResponsesModelMemo: SurveyResultsLockedResponsesModelMemo;
};

export type SurveyResultsLockedResponsesRuntimePorts = {
  applyStatePatch: (patch: unknown, afterApply?: () => void) => void;
  decryptEnvelopeValue: (envelope: unknown, options: CryptoGateDecryptOptions) => Promise<unknown>;
  getEffectiveSessionContext: () => { sessionConfig?: unknown; sessionSlug?: string };
  getEffectiveSlug: () => string;
  getNetworkQuestionsForCurrentContext: () => Record<string, SurveyResultsQuestionWithEncryption>;
  getProps: () => SurveyResultsProps;
  getState: () => SurveyResultsState;
  logWarn: (...args: unknown[]) => void;
  resolveSbtDisplayLabel: SurveyResultsSbtDisplayLabelResolver;
  resolveSessionContext: (slug: string) => { sessionConfig?: unknown; sessionSlug?: string };
};

export type SurveyResultsLockedResponsesRuntimeArgs = {
  instance: SurveyResultsLockedResponsesRuntimeInstance;
  ports: SurveyResultsLockedResponsesRuntimePorts;
};

const toSurveyResultsRecord = (value: unknown): SurveyResultsRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsRecord) : {};

export const createSurveyResultsLockedResponsesRuntime = ({
  instance,
  ports,
}: SurveyResultsLockedResponsesRuntimeArgs) => {
  const getDecryptLitHooks = (): SurveyResultsLitHooks | null => {
    const props = ports.getProps();
    if (props.lit && typeof props.lit === 'object') {
      return props.lit as SurveyResultsLitHooks;
    }
    if (props.litHooks && typeof props.litHooks === 'object') {
      return props.litHooks as SurveyResultsLitHooks;
    }
    if (typeof window === 'undefined') return null;
    const windowWithLitHooks = window as SurveyResultsWindowWithLitHooks;
    return windowWithLitHooks.__litHooks || windowWithLitHooks.litHooks || null;
  };

  const getQuestionEncryptionGates = (
    question: SurveyResultsQuestionWithEncryption | null = null,
  ): SurveyResultsGateRecord[] => {
    const encryption = question?.encryption as SurveyResultsQuestionEncryptionRecord | null | undefined;
    if (!encryption || typeof encryption !== 'object' || encryption.enabled === false) return [];
    const list = Array.isArray(encryption.gates)
      ? encryption.gates
      : encryption.gate && typeof encryption.gate === 'object'
        ? [encryption.gate]
        : [];
    return list.filter((gate): gate is SurveyResultsGateRecord => !!gate && typeof gate === 'object');
  };

  const getLockedResponseKey = ({
    responder = '',
    questionId = '',
    surveyId = '',
    response = null,
  }: SurveyResultsLockedResponseKeyArgs = {}): string => {
    const responderLower = String(responder || '')
      .trim()
      .toLowerCase();
    const qidLower = String(questionId || response?.questionID || response?.questionId || '')
      .trim()
      .toLowerCase();
    const surveyKey = String(surveyId || '')
      .trim()
      .toLowerCase();
    return [surveyKey, responderLower, qidLower, buildLockedResponseSignature(response || {})].join('|');
  };

  const getDecryptedResponseOverride = (key: unknown = ''): SurveyResultsDecryptedResponseOverride | null => {
    if (!key) return null;
    const overrides = toSurveyResultsRecord(ports.getState().decryptedResponseOverrides);
    const override = overrides[String(key)] || null;
    return override && typeof override === 'object' ? (override as SurveyResultsDecryptedResponseOverride) : null;
  };

  const applyDecryptedOverrideToResponse = ({
    response = null,
    key = '',
  }: {
    key?: unknown;
    response?: SurveyResultsResponseRecord | null;
  } = {}): SurveyResultsResponseRecord | null => {
    if (!response || typeof response !== 'object' || !key) return response;
    const override = getDecryptedResponseOverride(key);
    if (!override || typeof override !== 'object') return response;

    let changed = false;
    const next: SurveyResultsRecord = { ...response };

    if (hasOwn(override, 'answerValue') && next.answer && typeof next.answer === 'object') {
      next.answer = { ...toSurveyResultsRecord(next.answer), value: override.answerValue };
      changed = true;
    }
    if (hasOwn(override, 'additionalValue') && next.additional && typeof next.additional === 'object') {
      next.additional = { ...toSurveyResultsRecord(next.additional), value: override.additionalValue };
      changed = true;
    }
    if (hasOwn(override, 'importance')) {
      next.importance = override.importance;
      changed = true;
    }
    if (hasOwn(override, 'conviction')) {
      next.conviction = override.conviction;
      changed = true;
    }

    return changed ? (next as SurveyResultsResponseRecord) : response;
  };

  const buildLockedGateDetails = (
    lockedRows: unknown = [],
    questionLookup: Record<string, SurveyResultsQuestionWithEncryption> = {},
  ): SurveyResultsLockedGateDetailsResult => {
    const rows = Array.isArray(lockedRows) ? (lockedRows as SurveyResultsLockedRow[]) : [];
    if (rows.length === 0) {
      return { gateDetails: [], hasGenericGateMessage: false };
    }

    const props = ports.getProps();
    const state = ports.getState();
    const resolvedSession = ports.getEffectiveSessionContext();
    const baseSlug = resolvedSession.sessionSlug || '';
    const baseSessionConfig = toSurveyResultsRecord(resolvedSession.sessionConfig) as SurveyResultsSessionConfigRecord;
    const baseFallbackChainId =
      Number(
        props.network?.id ||
          props.networkChainId ||
          baseSessionConfig?.networkChainId ||
          baseSessionConfig?.__registry?.chainId ||
          0,
      ) || null;
    const sessionContextMemo = new Map<string, SurveyResultsLockedGateContext>();
    const readSessionGateContext = (questionSlug: unknown = ''): SurveyResultsLockedGateContext => {
      const requestedSlug = String(questionSlug || '').trim() || baseSlug;
      if (sessionContextMemo.has(requestedSlug)) {
        return sessionContextMemo.get(requestedSlug) as SurveyResultsLockedGateContext;
      }
      const nextResolvedSession = ports.resolveSessionContext(requestedSlug);
      const nextSlug = nextResolvedSession.sessionSlug || requestedSlug || baseSlug;
      const nextSessionConfig = toSurveyResultsRecord(
        nextResolvedSession.sessionConfig,
      ) as SurveyResultsSessionConfigRecord;
      const nextFallbackChainId =
        Number(
          props.network?.id ||
            props.networkChainId ||
            nextSessionConfig?.networkChainId ||
            nextSessionConfig?.__registry?.chainId ||
            baseFallbackChainId ||
            0,
        ) || null;
      const sponsoredConfig = toSurveyResultsRecord(nextSessionConfig.sponsored);
      const nextContext = {
        slug: nextSlug,
        fallbackChainId: nextFallbackChainId,
        defaultPolicy: buildResponseGatePolicy({
          cfg: nextSessionConfig,
          isQuestionResponseFlow: state.viewMode === 'questions',
          fallbackChainId: nextFallbackChainId,
        }) as SurveyResultsRecord & { gates?: unknown },
        configuredGateMap: toSurveyResultsRecord(sponsoredConfig.gates) as Record<string, SurveyResultsGateRecord>,
      };
      sessionContextMemo.set(requestedSlug, nextContext);
      return nextContext;
    };

    return buildSurveyResultsLockedGateDetails({
      baseSlug,
      buildSbtDetailPath,
      getQuestionEncryptionGates: (question) =>
        getQuestionEncryptionGates(toSurveyResultsRecord(question) as SurveyResultsQuestionWithEncryption | null),
      getShortenedAddress,
      lockedRows: rows,
      normalizeGateSbtEntries: (gate) =>
        normalizeGateSbtEntries(toSurveyResultsRecord(gate) as SurveyResultsGateRecord),
      normalizeGateText,
      questionLookup,
      readSessionGateContext,
      resolveSbtDisplayLabel: ports.resolveSbtDisplayLabel,
    }) as SurveyResultsLockedGateDetailsResult;
  };

  const getMemoizedLockedResponsesModel = (
    questionLookup: Record<string, SurveyResultsQuestionWithEncryption> = {},
  ): SurveyResultsLockedResponsesModel => {
    const {
      viewMode,
      surveyViewMode,
      sbtFilteredResponses,
      sbtFilteredAggregatorQuestionResponses,
      decryptedResponseOverrides,
    } = ports.getState();
    const slug = ports.getEffectiveSlug();
    const memo = (instance._lockedResponsesModelMemo || {}) as SurveyResultsLockedResponsesModelMemo;
    if (
      memo.viewMode === viewMode &&
      memo.surveyViewMode === surveyViewMode &&
      memo.responsesRef === sbtFilteredResponses &&
      memo.aggregatorRef === sbtFilteredAggregatorQuestionResponses &&
      memo.questionLookupRef === questionLookup &&
      memo.overridesRef === decryptedResponseOverrides &&
      memo.slug === slug
    ) {
      return (
        memo.result || {
          lockedRows: [],
          lockedCount: 0,
          gateDetails: [],
          hasGenericGateMessage: false,
        }
      );
    }

    const lockedRows = buildSurveyResultsLockedRows({
      aggregatorQuestionResponses: sbtFilteredAggregatorQuestionResponses,
      applyDecryptedOverrideToResponse: ({ response, key }) =>
        applyDecryptedOverrideToResponse({
          response: response as SurveyResultsResponseRecord | null,
          key,
        }),
      getLockedResponseKey: (args) =>
        getLockedResponseKey({
          ...args,
          response: args.response as SurveyResultsResponseRecord | null,
        }),
      isBannerEligibleLockedField: (field) =>
        isBannerEligibleLockedField(field as SurveyResultsEncryptedFieldRecord | null | undefined),
      sbtFilteredResponses,
      surveyId: ports.getState().surveyId,
      surveyViewMode,
      viewMode,
    }) as SurveyResultsLockedRow[];

    const { gateDetails, hasGenericGateMessage } = buildLockedGateDetails(lockedRows, questionLookup);
    const result = {
      lockedRows,
      lockedCount: lockedRows.length,
      gateDetails,
      hasGenericGateMessage,
    };
    instance._lockedResponsesModelMemo = {
      viewMode,
      surveyViewMode,
      responsesRef: sbtFilteredResponses,
      aggregatorRef: sbtFilteredAggregatorQuestionResponses,
      questionLookupRef: questionLookup,
      overridesRef: decryptedResponseOverrides,
      slug,
      result,
    };
    return result;
  };

  const getCryptoGateDecryptOptions = (): CryptoGateDecryptOptions => {
    const props = ports.getProps();
    const litHooks = getDecryptLitHooks();
    const litOpts = litHooks && typeof litHooks.getKey === 'function' ? { getKey: litHooks.getKey } : undefined;
    return {
      account: props.account,
      chainId: props.network?.id || props.networkChainId || null,
      providerLike: props.provider,
      ...(litOpts ? { litOpts } : {}),
    };
  };

  const decryptFieldValue = async (
    field: SurveyResultsEncryptedFieldRecord | null = null,
  ): Promise<SurveyResultsDecryptFieldResult> => {
    if (!field || typeof field !== 'object') return { ok: false };
    const envelope = extractEnvelopeCandidate(field);
    if (!envelope) return { ok: false };

    const decryptOptions = getCryptoGateDecryptOptions();
    try {
      const value = await ports.decryptEnvelopeValue(envelope, decryptOptions);
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error };
    }
  };

  const handleDecryptLockedResponses = async (): Promise<void> => {
    const props = ports.getProps();
    const state = ports.getState();
    if (state.lockedResponsesDecrypting) return;
    if (!props.loginComplete || !props.account) {
      ports.applyStatePatch(buildSurveyResultsAlertMessagePatch('Login required to decrypt locked responses.'));
      return;
    }

    const questionLookup = ports.getNetworkQuestionsForCurrentContext();
    const model = getMemoizedLockedResponsesModel(questionLookup);
    const lockedRows = Array.isArray(model?.lockedRows) ? model.lockedRows : [];
    if (lockedRows.length === 0) return;

    ports.applyStatePatch(buildSurveyResultsLockedResponsesDecryptingPatch(true));

    let anyDecrypted = false;
    const nextOverrides: Record<string, SurveyResultsDecryptedResponseOverride> = {
      ...(toSurveyResultsRecord(ports.getState().decryptedResponseOverrides) as Record<
        string,
        SurveyResultsDecryptedResponseOverride
      >),
    };

    for (const row of lockedRows) {
      const response: SurveyResultsResponseRecord = row?.response || {};
      const override: SurveyResultsDecryptedResponseOverride = { ...(nextOverrides[row.key] || {}) };

      if (isLockedEncryptedField(row?.mergedResponse?.answer)) {
        const answerResult = await decryptFieldValue(response.answer);
        if (answerResult.ok) {
          override.answerValue = answerResult.value;
          anyDecrypted = true;
        }
      }

      if (isLockedEncryptedField(row?.mergedResponse?.additional)) {
        const additionalResult = await decryptFieldValue(response.additional);
        if (additionalResult.ok) {
          override.additionalValue = additionalResult.value;
          anyDecrypted = true;
        }
      }

      if (
        typeof response?.importanceEncrypted === 'string' &&
        response.importanceEncrypted.trim() &&
        !hasOwn(override, 'importance')
      ) {
        try {
          const importance = await ports.decryptEnvelopeValue(
            response.importanceEncrypted,
            getCryptoGateDecryptOptions(),
          );
          override.importance = Number.isNaN(Number(importance)) ? importance : Number(importance);
          anyDecrypted = true;
        } catch (e) {
          ports.logWarn('SurveyResults: fallback', e);
        }
      }

      if (
        typeof response?.convictionEncrypted === 'string' &&
        response.convictionEncrypted.trim() &&
        !hasOwn(override, 'conviction')
      ) {
        try {
          const conviction = await ports.decryptEnvelopeValue(
            response.convictionEncrypted,
            getCryptoGateDecryptOptions(),
          );
          override.conviction = Number.isNaN(Number(conviction)) ? conviction : Number(conviction);
          anyDecrypted = true;
        } catch (e) {
          ports.logWarn('SurveyResults: fallback', e);
        }
      }

      if (Object.keys(override).length > 0) {
        nextOverrides[row.key] = override;
      }
    }

    ports.applyStatePatch(
      buildSurveyResultsLockedResponsesDecryptCompletePatch({
        anyDecrypted,
        decryptedResponseOverrides: nextOverrides,
        walletLowerLabel: t('walletLower'),
      }),
    );
  };

  const toggleLockedResponseDetails = (): void => {
    ports.applyStatePatch((prevState: SurveyResultsState) => toggleSurveyResultsLockedResponseDetailsPatch(prevState));
  };

  return {
    applyDecryptedOverrideToResponse,
    getLockedResponseKey,
    getMemoizedLockedResponsesModel,
    getQuestionEncryptionGates,
    handleDecryptLockedResponses,
    toggleLockedResponseDetails,
  };
};
