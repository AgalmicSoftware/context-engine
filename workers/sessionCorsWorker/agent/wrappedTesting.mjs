import { stableJson, kvKeySafePart } from './runtimePrimitives.mjs';
import { answerStateKey, voteStateKey } from './wrappedCore.mjs';
import { normalizeAgentOnlyModeConfigPatch } from './wrappedConfig.mjs';
import { statementFromQuestion } from './wrappedStatements.mjs';
import { normalizeAgentMetadata } from './wrappedMetadata.mjs';
import { normalizeAnswerForSchema } from './wrappedAnswers.mjs';

export const __test__agentOnlyMode = {
  normalizeAnswerForSchema,
  normalizeAgentMetadata,
  normalizeAgentOnlyModeConfigPatch,
  statementFromQuestion,
  stableJson,
  answerStateKey,
  voteStateKey,
  kvKeySafePart,
};
