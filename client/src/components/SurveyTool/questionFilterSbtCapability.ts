import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import {
  resolveEffectiveSessionContext,
  type QuestionFilterSerializableState,
  type QuestionFilterSessionProps,
  type UnknownRecord,
} from './questionFilterRuntimeSupport';

export const resolveQuestionFilterSbtSessionConfig = (propsIn: QuestionFilterSessionProps = {}): unknown => {
  const resolved = resolveEffectiveSessionContext(propsIn);
  const config =
    propsIn.sessionConfig && typeof propsIn.sessionConfig === 'object'
      ? (propsIn.sessionConfig as UnknownRecord)
      : (resolved.sessionConfig as UnknownRecord) || {};
  const resolvedSlug = String(
    config.slug || resolved.sessionSlug || propsIn.activeSessionSlug || propsIn.sessionSlug || '',
  )
    .trim()
    .toLowerCase();
  return resolvedSlug && !String(config.slug || '').trim() ? { ...config, slug: resolvedSlug } : config;
};

export const shouldEnableQuestionFilterSbt = (sessionConfig: unknown): boolean => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (projection.source === 'profile') return projection.profileValid && projection.usesOnChainSbt;
  if (projection.source === 'legacy_registry') return true;
  if (projection.source === 'invalid_profile') return false;

  const config =
    sessionConfig && typeof sessionConfig === 'object' && !Array.isArray(sessionConfig)
      ? (sessionConfig as UnknownRecord)
      : {};
  const hasConcreteSessionIdentity = [config.slug, config.sessionSlug, config.sessionId, config.sessionIdHex].some(
    (value) => String(value || '').trim().length > 0,
  );
  return !hasConcreteSessionIdentity;
};

export const buildQuestionFilterLostSbtCapabilityPatch = ({
  nextProps,
  previousProps,
  state,
}: {
  nextProps: QuestionFilterSessionProps;
  previousProps: QuestionFilterSessionProps;
  state: UnknownRecord;
}): UnknownRecord | null => {
  const capabilityWasLost =
    shouldEnableQuestionFilterSbt(resolveQuestionFilterSbtSessionConfig(previousProps)) &&
    !shouldEnableQuestionFilterSbt(resolveQuestionFilterSbtSessionConfig(nextProps));
  if (
    !capabilityWasLost ||
    (state.sbtFilterLocalState === null &&
      state.sbtFilteredQuestions === null &&
      state.pendingSbtFilteredQuestions === null)
  ) {
    return null;
  }
  return {
    pendingSbtFilteredQuestions: null,
    sbtFilteredQuestions: null,
    sbtFilterLocalState: null,
  };
};

export const suppressQuestionFilterSbtState = (
  filterState: QuestionFilterSerializableState,
  sbtEnabled: boolean,
): QuestionFilterSerializableState => {
  if (!sbtEnabled) filterState.sbtFilter = null;
  return filterState;
};
