export const AGENT_ASK_WHICH_WAY: string;
export const AGENT_REVIEW_NEXT_STEP: string;
export const AGENT_PROMPT_LINK_QUERY: string;
export const AGENT_FLOW_INTRO: string;
export type AgentFlowStep = 'can' | 'draft' | 'submit' | 'account' | 'unknown';
export const AGENT_FLOW_STEPS: Record<AgentFlowStep, string>;
export function agentFlowLines(steps?: AgentFlowStep[]): string[];
export function agentFlowText(): string;
