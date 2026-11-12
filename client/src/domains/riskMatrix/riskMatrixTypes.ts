import type { ResultsBuildSummary } from '../resultsBuilds/resultsBuildWorkerClient';

// A build as the Session Worker stores it (workers/sessionCorsWorker/riskMatrixBuild.js).
export type RiskMatrixArea = { name: string; subareas: string[] };
// What a subarea of one area means for a subarea of another: `cell` is
// "From area.From subarea.To area.To subarea".
export type RiskMatrixNote = {
  cell: string;
  valence: 'opportunity' | 'risk';
  intensity: number;
  comment: string;
  participantCount: number;
  questionIds: string[];
};
export type RiskMatrixBuild = ResultsBuildSummary & { areas: RiskMatrixArea[]; notes: RiskMatrixNote[] };
