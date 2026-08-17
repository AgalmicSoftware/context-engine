import React from 'react';

import {
  SurveyResultsAggregatorEmptyState,
  SurveyResultsFreeformSummaryDisplay,
  SurveyResultsMultichoiceDistributionDisplay,
} from './SurveyResultsAggregatorSummaryDisplay';

type FreeformDisplayedResponse = {
  additional?: string;
  responder?: unknown;
  value?: unknown;
};

export type FreeformAggregatorSummaryModel = {
  blankCount?: number;
  displayedResponses?: FreeformDisplayedResponse[];
  encryptedCount?: number;
  totalResponses?: number;
};

type MultichoiceSummaryOption = {
  count: number;
  key: string;
  label: string;
};

export type MultichoiceAggregatorSummaryModel = {
  options?: MultichoiceSummaryOption[];
  totalResponders?: number;
};

export const SurveyResultsFreeformAggregatorSummary = ({
  summary = {},
}: {
  summary?: FreeformAggregatorSummaryModel;
}): React.ReactElement => {
  const totalResponses = Number(summary.totalResponses || 0);
  const encryptedCount = Number(summary.encryptedCount || 0);
  const blankCount = Number(summary.blankCount || 0);
  const displayedResponses = Array.isArray(summary.displayedResponses) ? summary.displayedResponses : [];

  if (totalResponses === 0 && encryptedCount === 0 && blankCount === 0) {
    return <SurveyResultsAggregatorEmptyState>No freeform responses available.</SurveyResultsAggregatorEmptyState>;
  }

  return (
    <SurveyResultsFreeformSummaryDisplay
      summary={{
        blankCount,
        displayedResponses,
        encryptedCount,
        totalResponses,
      }}
    />
  );
};

export const SurveyResultsMultichoiceAggregatorSummary = ({
  summary = {},
}: {
  summary?: MultichoiceAggregatorSummaryModel;
}): React.ReactElement => {
  const options = Array.isArray(summary.options) ? summary.options : [];
  const totalResponders = Number(summary.totalResponders || 0);

  if (options.length === 0) {
    return (
      <SurveyResultsAggregatorEmptyState>
        No multichoice options are defined for this question.
      </SurveyResultsAggregatorEmptyState>
    );
  }

  if (totalResponders === 0) {
    return <SurveyResultsAggregatorEmptyState>No multichoice responses available.</SurveyResultsAggregatorEmptyState>;
  }

  return (
    <SurveyResultsMultichoiceDistributionDisplay
      summary={{
        options,
        totalResponders,
      }}
    />
  );
};
