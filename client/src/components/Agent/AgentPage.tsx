import React, { useEffect, useMemo, useState } from 'react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { toStr } from '../../utilities/shared/primitives.js';

type AgentAction = Record<string, unknown>;

type AgentState = {
  route?: unknown;
  account?: unknown;
};

type CeAgent = {
  getState?: () => AgentState;
  run?: (actions: AgentAction[]) => Promise<unknown>;
  perform?: (action: AgentAction) => Promise<unknown>;
};

type AgentLogLine = {
  at: string;
  kind: string;
  [key: string]: unknown;
};

declare global {
  interface Window {
    __ceAgent?: CeAgent | null;
  }
}

const readAgent = (): CeAgent | null => (typeof window !== 'undefined' ? window.__ceAgent || null : null);

const defaultActions: AgentAction[] = [
  { type: 'navigate', to: '/compare/' },
  { type: 'fill', testId: 'ce-compare-address-a', value: '0x0000000000000000000000000000000000000001' },
  { type: 'fill', testId: 'ce-compare-address-b', value: '0x0000000000000000000000000000000000000002' },
  { type: 'click', testId: 'ce-compare-run' },
  { type: 'assertVisible', testId: 'ce-compare-result' },

  { type: 'invokeAi', tool: 'PolisReport', params: { sessionSlug: 'ai-browseruse-75209033' } },
];

export default function AgentPage() {
  const [actionsText, setActionsText] = useState(() => `${JSON.stringify(defaultActions, null, 2)}\n`);
  const [logLines, setLogLines] = useState<AgentLogLine[]>([]);
  const [stepIdx, setStepIdx] = useState(0);

  // Agent is installed globally in App.componentDidMount; force one re-render after mount
  // so the initial "Enabled" status reflects the latest window.__ceAgent.
  const [, forceRerender] = useState(0);
  useEffect(() => {
    forceRerender((n) => n + 1);
  }, []);

  const agent = readAgent();
  const agentState = useMemo(() => {
    try {
      return agent && typeof agent.getState === 'function' ? agent.getState() : null;
    } catch (_) {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  const appendLog = (entry: Record<string, unknown> & { kind: string }) => {
    setLogLines((prev) => [...prev, { at: new Date().toISOString(), ...entry }]);
  };

  const parseActionsOrThrow = (): AgentAction[] => {
    const raw = toStr(actionsText).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Agent actions must be a JSON array.');
    return parsed;
  };

  const handleRun = async () => {
    setStepIdx(0);
    setLogLines([]);
    try {
      const agentNow = readAgent();
      if (!agentNow || typeof agentNow.run !== 'function') {
        throw new Error('Agent Mode is not enabled. Add `?agent=1` or set localStorage `ce-agent-enabled=1`, then reload.');
      }
      const actions = parseActionsOrThrow();
      appendLog({ kind: 'run:start', actions: actions.length });
      const result = await agentNow.run(actions);
      appendLog({ kind: 'run:result', result });
    } catch (e) {
      appendLog({ kind: 'run:error', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleStep = async () => {
    try {
      const agentNow = readAgent();
      if (!agentNow || typeof agentNow.perform !== 'function') {
        throw new Error('Agent Mode is not enabled. Add `?agent=1` or set localStorage `ce-agent-enabled=1`, then reload.');
      }
      const actions = parseActionsOrThrow();
      if (stepIdx >= actions.length) {
        appendLog({ kind: 'step:done', stepIdx, actions: actions.length });
        return;
      }
      const action = actions[stepIdx];
      appendLog({ kind: 'step:start', stepIdx, action });
      const res = await agentNow.perform(action);
      appendLog({ kind: 'step:result', stepIdx, res });
      setStepIdx((i) => i + 1);
    } catch (e) {
      appendLog({ kind: 'step:error', stepIdx, error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div style={{ padding: 20, color: '#fff' }}>
      <h2 style={{ margin: 0, marginBottom: 10 }}>Agent Mode</h2>
      <div style={{ opacity: 0.85, marginBottom: 16, fontSize: 13 }}>
        <div>
          <strong>Enabled:</strong> {agent ? 'yes' : 'no'}
        </div>
        {agentState && (
          <div>
            <strong>State:</strong> <code>{toStr(agentState.route)}</code> {' '}
            {agentState.account ? <span>(wallet: <code>{toStr(agentState.account)}</code>)</span> : null}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 980 }}>
        <textarea
          data-testid={E2E_TESTIDS.AGENT_ACTIONS}
          value={actionsText}
          onChange={(e) => setActionsText(e.target.value)}
          rows={16}
          spellCheck={false}
          style={{
            width: '100%',
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.35,
          }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid={E2E_TESTIDS.AGENT_RUN}
            onClick={handleRun}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.10)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Run
          </button>
          <button
            type="button"
            data-testid={E2E_TESTIDS.AGENT_STEP}
            onClick={handleStep}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Step ({stepIdx})
          </button>
        </div>

        <pre
          data-testid={E2E_TESTIDS.AGENT_LOG}
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.35)',
            color: '#fff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: 12,
            lineHeight: 1.35,
            maxHeight: 360,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {logLines.length ? `${JSON.stringify(logLines, null, 2)}\n` : 'Log is empty.\n'}
        </pre>
      </div>
    </div>
  );
}
