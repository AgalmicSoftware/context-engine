export const PUBLIC_WORKER_CONFIG_FIELDS: readonly string[];
/** The parts of `ai` the public config shows. */
export const PUBLIC_WORKER_AI_FIELDS: readonly string[];
/** The public config field a Worker sets when its set-config merges `ai`. */
export const SET_CONFIG_MERGES_AI_FIELD: 'setConfigMergesAi';
/** The public config field a Worker sets when it builds debate atlases and accepts results admins. */
export const DEBATE_ATLAS_FIELD: 'debateAtlas';
/** The public config field a Worker sets when it builds risk matrices. */
export const RISK_MATRIX_FIELD: 'riskMatrix';
