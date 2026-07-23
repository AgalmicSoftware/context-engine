import React from 'react';

import { QuestionFilterSbtSection } from './QuestionFilterSections';
import {
  resolveEffectiveSessionContext,
  resolveEffectiveSlug,
  type QuestionFilterSessionProps,
  type UnknownRecord,
} from './questionFilterRuntimeSupport';
import { resolveQuestionFilterSbtSessionConfig, shouldEnableQuestionFilterSbt } from './questionFilterSbtCapability';

type QuestionFilterSbtSectionHost = {
  handleFilteredQuestions: (filtered: unknown, newSbtFilterLocalState: unknown) => void;
  props: QuestionFilterSessionProps;
  setFilterLoading: (loading: unknown) => void;
  state: UnknownRecord;
  toggleSection: (section: string) => void;
};

export function QuestionFilterCapabilitySbtSection({
  disabled,
  disabledReason,
  expandedSections,
  host,
}: {
  disabled: boolean;
  disabledReason: string;
  expandedSections: Record<string, unknown>;
  host: QuestionFilterSbtSectionHost;
}): JSX.Element | null {
  if (!shouldEnableQuestionFilterSbt(resolveQuestionFilterSbtSessionConfig(host.props))) return null;

  const resolvedSession = resolveEffectiveSessionContext(host.props);
  const sessionSlug = resolvedSession.sessionSlug || resolveEffectiveSlug(host.props);
  const sessionConfig = host.props.sessionConfig || resolvedSession.sessionConfig || {};

  return (
    <QuestionFilterSbtSection
      creatorAndResponderMode={host.props.creatorAndResponderMode}
      defaultFeaturedSBTs={host.props.defaultFeaturedSBTs}
      disabled={disabled}
      disabledReason={disabledReason}
      ensureLightSbtUniverse={host.props.ensureLightSbtUniverse}
      expandedSections={expandedSections}
      isQuestionCacheReady={host.props.isQuestionCacheReady}
      isSBTCacheReady={host.props.isSBTCacheReady}
      isSurveyCacheReady={host.props.isSurveyCacheReady}
      items={host.state.mergedQuestions}
      network={host.props.network}
      onFilter={host.handleFilteredQuestions}
      onToggleSection={host.toggleSection}
      provider={host.props.provider}
      sbtCacheRevision={host.props.sbtCacheRevision}
      sbtFilterLocalState={host.state.sbtFilterLocalState}
      sessionConfig={sessionConfig}
      sessionSlug={sessionSlug}
      setFilterLoading={host.setFilterLoading}
    />
  );
}
