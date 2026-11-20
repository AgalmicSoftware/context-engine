import type { DebateAtlasBuild } from '../debateAtlas/debateAtlasTypes';

// An atlas topic as a risk matrix note can open it: the node its atlas view opens, its name and its questions.
export type RiskMatrixAtlasTopic = { nodeId: string; label: string; questionIds: string[] };

// The atlas's topics in its own order. A node id is "<build id>:<topic id>", as the atlas view names its nodes.
export const listAtlasTopics = (atlas: DebateAtlasBuild): RiskMatrixAtlasTopic[] =>
  (atlas.branches || []).flatMap((branch) =>
    (branch.topics || []).map((topic) => ({
      nodeId: `${atlas.id}:${topic.id}`,
      label: topic.label,
      questionIds: (topic.questions || []).map(({ id }) => id),
    })),
  );

// A matrix and an atlas are built apart and share no ids but their questions, each in one atlas topic. A note
// leads to the topic that holds most of its questions; on a tie, the first in the atlas's order.
export const findAtlasTopicForQuestions = (
  questionIds: string[] = [],
  topics: RiskMatrixAtlasTopic[] = [],
): RiskMatrixAtlasTopic | null => {
  const wanted = new Set(questionIds);
  let found: RiskMatrixAtlasTopic | null = null;
  let held = 0;
  for (const topic of topics) {
    const count = topic.questionIds.filter((id) => wanted.has(id)).length;
    if (count > held) {
      found = topic;
      held = count;
    }
  }
  return found;
};
