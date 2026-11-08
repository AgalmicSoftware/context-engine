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
};
export type DebateAtlasTopic = DebateAtlasMapping & {
  id: string;
  label: string;
  questions?: Array<{ id: string; prompt: string; type?: string }>;
};
export type DebateAtlasBranch = DebateAtlasMapping & { id: string; label: string; topics: DebateAtlasTopic[] };
export type DebateAtlasBuildSummary = {
  id: string;
  builtAt: string;
  builtBy?: string;
  model?: string;
  title?: string;
  counts?: {
    responses?: number;
    participants?: number;
    questions?: number;
    aiResponses?: number;
    aiQuestions?: number;
  };
  missingTopics?: string[];
};
export type DebateAtlasBuild = DebateAtlasBuildSummary & { branches: DebateAtlasBranch[] };
// What a build would send now: the model, and the prompts with the session's data as placeholders.
export type DebateAtlasNextBuild = { model?: string; prompts?: { plan?: string; map?: string } };
