import { renderHook } from '@testing-library/react';
import useSessionWizardCachedInitialState from './useSessionWizardCachedInitialState';

describe('useSessionWizardCachedInitialState', () => {
  it('resolves cached gates and gives an explicit session ID precedence over cache', () => {
    const { result } = renderHook(() =>
      useSessionWizardCachedInitialState({
        cachedWizard: {
          sessionId: '11112233-4455-6677-8899-aabbccddeeff',
          defaultGateId: 'gate-2',
          encryptionGates: [{ id: 'gate-2', label: 'Gate B', sbts: [] }],
          gateSelections: { 'gate-2': { chainId: 11155420, mode: 'all', sbts: [] } },
        },
        initialDraftNetworkChainId: 11155420,
        networkId: 84532,
        initialSessionId: '00112233-4455-6677-8899-aabbccddeeff',
      }),
    );

    expect(result.current.initialSessionIdValue).toBe('00112233-4455-6677-8899-aabbccddeeff');
    expect(result.current.initialGates).toEqual([{ id: 'gate-2', label: 'Gate B', sbts: [] }]);
    expect(result.current.initialDefaultGateId).toBe('gate-2');
    expect(result.current.initialGateSelections).toEqual({
      'gate-2': { chainId: 11155420, mode: 'all', sbts: [] },
    });
  });

  it('builds the domain defaults when no cache values exist', () => {
    const { result } = renderHook(() =>
      useSessionWizardCachedInitialState({ initialDraftNetworkChainId: 11155420 }),
    );

    expect(result.current.initialGates[0]).toEqual(expect.objectContaining({ id: 'gate-1', mode: 'all' }));
    expect(result.current.initialDefaultGateId).toBe('gate-1');
    expect(result.current.initialGateSelections).toEqual(
      expect.objectContaining({ default: expect.objectContaining({ chainId: 11155420 }) }),
    );
    expect(result.current.initialSessionIdValue).toBeTruthy();
  });
});
