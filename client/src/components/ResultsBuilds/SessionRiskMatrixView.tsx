import React, { useMemo } from 'react';

import RiskMatrix from '../MainContent/RiskMatrix';
import ResultsBuildPanel from './ResultsBuildPanel';
import type { ResultsBuildSummary } from '../../domains/resultsBuilds/resultsBuildWorkerClient';
import type { RiskMatrixBuild } from '../../domains/riskMatrix/riskMatrixTypes';

type Props = {
  build: RiskMatrixBuild;
  builds: ResultsBuildSummary[];
  onSelectBuild: (id: string) => void;
};

// A built risk matrix replaces the demo's and AI Views' one: read-only, with the
// areas the AI named and its notes on where two of them meet.
export default function SessionRiskMatrixView({ build, builds, onSelectBuild }: Props) {
  const categories = useMemo(
    () => build.areas.map(({ name, subareas }) => ({ name, subcategories: subareas })),
    [build.areas],
  );

  return (
    <ResultsBuildPanel
      kind="risk-matrix"
      label="Risk matrix"
      build={build}
      builds={builds}
      onSelectBuild={onSelectBuild}
      help="The session's AI built this from the responses at that moment. Each note is an opportunity or a risk that one area, the column, holds for another, the row, at an intensity from 1 to 10; a cell adds its opportunities and subtracts its risks. Open a cell for its notes."
    >
      <RiskMatrix
        key={build.id}
        categories={categories}
        initialComments={build.notes}
        commentEyebrow="AI note"
        readOnly
        embedded
      />
    </ResultsBuildPanel>
  );
}
