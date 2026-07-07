/**
 * @module ceAgentContract
 * @description Stable metadata describing the dev/e2e `window.__ceAgent` surface.
 *
 * Key exports: describeCeAgentContract
 */

export const CE_AGENT_CONTRACT_VERSION = 1;

export interface AgentAction {
  type: string;
  required: readonly string[];
  description: string;
}

export interface AgentTool {
  name: string;
  description: string;
}

export interface CeAgentContract {
  version: number;
  activation: {
    devOnly: boolean;
    route: string;
    queryParam: string;
    localStorageKey: string;
  };
  docs: {
    bootstrap: string;
    testIdApi: string;
    e2eSetup: string;
  };
  actions: AgentAction[];
  tools: AgentTool[];
  notes: string[];
}

const ACTIONS: readonly AgentAction[] = Object.freeze([
  Object.freeze({
    type: 'navigate',
    required: Object.freeze(['to']),
    description: 'Change the SPA route through history state and wait for the route to update.',
  }),
  Object.freeze({
    type: 'fill',
    required: Object.freeze(['testId', 'value']),
    description: 'Fill an input or textarea located through the stable TestID API.',
  }),
  Object.freeze({
    type: 'click',
    required: Object.freeze(['testId']),
    description: 'Click a target located through the stable TestID API.',
  }),
  Object.freeze({
    type: 'assertVisible',
    required: Object.freeze(['testId']),
    description: 'Wait for a stable TestID target to become visibly rendered.',
  }),
  Object.freeze({
    type: 'invokeAi',
    required: Object.freeze(['tool']),
    description: 'Run a higher-level deterministic workflow built on top of the lower-level actions.',
  }),
]);

const TOOLS: readonly AgentTool[] = Object.freeze([
  Object.freeze({
    name: 'CompareAddresses',
    description: 'Navigate to /compare/, fill two addresses, run the comparison, and wait for the result shell.',
  }),
  Object.freeze({
    name: 'PolisReport',
    description:
      'Open a session results view for an explicit sessionSlug or the current active session, enable demo data, run cluster analysis, and wait for ready output.',
  }),
]);

const cloneEntries = <T extends AgentAction | AgentTool>(entries: readonly T[]): T[] =>
  entries.map((entry) => ({
    ...entry,
    ...(Array.isArray((entry as AgentAction).required) ? { required: [...(entry as AgentAction).required] } : {}),
  }));

export const describeCeAgentContract = (): CeAgentContract => ({
  version: CE_AGENT_CONTRACT_VERSION,
  activation: {
    devOnly: true,
    route: '/agent',
    queryParam: 'agent=1',
    localStorageKey: 'ce-agent-enabled',
  },
  docs: {
    bootstrap: 'docs/ai-agent-bootstrap.md',
    testIdApi: 'docs/e2e-testid-api.md',
    e2eSetup: 'docs/e2e-setup.md',
  },
  actions: cloneEntries(ACTIONS),
  tools: cloneEntries(TOOLS),
  notes: [
    'fill, click, and assertVisible operate on stable data-testid hooks documented in the TestID API.',
    'invokeAi is intentionally narrow and deterministic; broader headless read/create surfaces remain planned work.',
    'PolisReport does not silently fall back to a legacy fixture slug; pass params.sessionSlug or select an active session first.',
  ],
});
