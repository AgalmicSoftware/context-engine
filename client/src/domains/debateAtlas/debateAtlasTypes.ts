import type { ResultsBuildSummary } from '../resultsBuilds/resultsBuildWorkerClient';

// A build as the Session Worker stores it (workers/sessionCorsWorker/debateAtlasBuild.js).
export type DebateAtlasPosition = { label: string; summary?: string; participantCount: number; x?: number; y?: number };
export type DebateAtlasPlacedParticipant = { address?: string; label?: string; x: number; y: number; reason?: string };
// A topic's map, and a branch's across all its topics.
export type DebateAtlasMapping = {
  summary?: string;
  compass?: {
    x: { label: string; left: string; right: string };
    y: { label: string; top: string; bottom: string };
  } | null;
  positions?: DebateAtlasPosition[];
  participants?: DebateAtlasPlacedParticipant[];
  // Everyone whose answers the AI read for it; a position's participantCount is a share of this.
  answered?: number;
};
export type DebateAtlasTopic = DebateAtlasMapping & {
  id: string;
  label: string;
  questions?: Array<{ id: string; prompt: string; type?: string }>;
};
export type DebateAtlasBranch = DebateAtlasMapping & { id: string; label: string; topics: DebateAtlasTopic[] };
export type DebateAtlasBuild = ResultsBuildSummary & { missingTopics?: string[]; branches: DebateAtlasBranch[] };
