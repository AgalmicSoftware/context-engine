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
// The AI's reading of one question's answers, in builds from a Worker that makes it: a summary, then the kinds of
// answer it found, most held first. `answered` is everyone whose answers it read; a category's count is a share
// of it, and one person may be counted in more than one category.
export type DebateAtlasQuestionAnalysis = {
  summary: string;
  categories?: Array<{ label: string; summary?: string; participantCount: number }>;
  answered?: number;
};
export type DebateAtlasQuestion = {
  id: string;
  prompt: string;
  type?: string;
  options?: string[];
  voiceCredits?: number;
  analysis?: DebateAtlasQuestionAnalysis;
};
export type DebateAtlasTopic = DebateAtlasMapping & { id: string; label: string; questions?: DebateAtlasQuestion[] };
export type DebateAtlasBranch = DebateAtlasMapping & { id: string; label: string; topics: DebateAtlasTopic[] };
// How far a build got with its questions' analyses, in builds that make them: `listed` questions in all,
// `summarised` with an analysis, `outOfTime` not reached or cut off. The rest failed or kept nothing.
export type DebateAtlasQuestionSummaries = { listed?: number; summarised?: number; outOfTime?: number };
export type DebateAtlasBuild = ResultsBuildSummary & {
  missingTopics?: string[];
  questionSummaries?: DebateAtlasQuestionSummaries;
  branches: DebateAtlasBranch[];
};
