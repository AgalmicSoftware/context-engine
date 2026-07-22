import { act, renderHook } from '@testing-library/react';
import { getCachedSessionWorkerConfig } from '../../utilities/session/sessionWorkerConfigCache.js';
import { useAdminAgentSessionWrappedConfigUpdate } from './useAdminAgentSessionWrappedConfigUpdate';

describe('useAdminAgentSessionWrappedConfigUpdate', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('updates the selected Admin entry and its non-secret Worker config cache', () => {
    let sessions: Array<[string, Record<string, unknown>]> = [
      ['alpha', { slug: 'alpha', sessionName: 'Alpha' }],
      ['beta', { slug: 'beta', sessionName: 'Beta' }],
    ];
    const setSessions = jest.fn((updater) => {
      sessions = updater(sessions);
    });
    const selectedConfig = sessions[0][1];
    const { result } = renderHook(() =>
      useAdminAgentSessionWrappedConfigUpdate({
        selectedConfig,
        selectedSlug: 'alpha',
        setSessions,
      }),
    );
    const configPatch = {
      agentSessionWrapped: { enabled: true },
      sessionModeProfile: { surfaces: { agentHttp: true } },
    };

    act(() => {
      result.current.handleConfigUpdated({ configPatch, workerUrl: 'https://session-worker.example.test' });
    });

    expect(sessions[0][1]).toEqual(expect.objectContaining(configPatch));
    expect(sessions[0][1].corsWorkerUrl).toBe('https://session-worker.example.test');
    expect(sessions[1][1]).toEqual({ slug: 'beta', sessionName: 'Beta' });
    expect(getCachedSessionWorkerConfig({ slug: 'alpha', sessionConfig: selectedConfig })).toEqual({
      corsWorkerUrl: 'https://session-worker.example.test',
    });
  });
});
