import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import useSessionWizardLiveRefs from './useSessionWizardLiveRefs.js';

const buildRefs = () => ({
  draftRef: { current: { slug: 'initial' } } as MutableRefObject<{ slug: string }>,
  deployFormRef: { current: { workerName: 'initial' } } as MutableRefObject<{ workerName: string }>,
  resolvedWalletAccountRef: { current: '0xexisting' } as MutableRefObject<string>,
  deployCompleteRef: { current: false } as MutableRefObject<boolean>,
  deployWorkerUrlRef: { current: '' } as MutableRefObject<string>,
  provisionedSponsoredContextRef: { current: { sessionSlug: '' } } as MutableRefObject<{ sessionSlug: string }>,
  workerSecretsEnabledRef: { current: false } as MutableRefObject<boolean>,
  persistWorkerSecretsRef: { current: false } as MutableRefObject<boolean>,
  workerSecretsRef: { current: { customRpcUrl: '' } } as MutableRefObject<{ customRpcUrl: string }>,
});

describe('useSessionWizardLiveRefs', () => {
  it('syncs live runtime refs from current values', () => {
    const refs = buildRefs();

    renderHook(() =>
      useSessionWizardLiveRefs({
        draft: { slug: 'current-draft' },
        draftRef: refs.draftRef,
        deployForm: { workerName: 'current-worker' },
        deployFormRef: refs.deployFormRef,
        account: '0xabc',
        resolvedWalletAccountRef: refs.resolvedWalletAccountRef,
        deployComplete: true,
        deployCompleteRef: refs.deployCompleteRef,
        deployWorkerUrl: 'https://worker.example.test',
        deployWorkerUrlRef: refs.deployWorkerUrlRef,
        provisionedSponsoredContext: { sessionSlug: 'sponsored-session' },
        provisionedSponsoredContextRef: refs.provisionedSponsoredContextRef,
        workerSecretsEnabled: true,
        workerSecretsEnabledRef: refs.workerSecretsEnabledRef,
        persistWorkerSecrets: true,
        persistWorkerSecretsRef: refs.persistWorkerSecretsRef,
        workerSecrets: { customRpcUrl: 'https://rpc.example.test' },
        workerSecretsRef: refs.workerSecretsRef,
      }),
    );

    expect(refs.draftRef.current).toEqual({ slug: 'current-draft' });
    expect(refs.deployFormRef.current).toEqual({ workerName: 'current-worker' });
    expect(refs.resolvedWalletAccountRef.current).toBe('0xabc');
    expect(refs.deployCompleteRef.current).toBe(true);
    expect(refs.deployWorkerUrlRef.current).toBe('https://worker.example.test');
    expect(refs.provisionedSponsoredContextRef.current).toEqual({ sessionSlug: 'sponsored-session' });
    expect(refs.workerSecretsEnabledRef.current).toBe(true);
    expect(refs.persistWorkerSecretsRef.current).toBe(true);
    expect(refs.workerSecretsRef.current).toEqual({ customRpcUrl: 'https://rpc.example.test' });
  });

  it('does not clear the resolved wallet ref for blank accounts', () => {
    const refs = buildRefs();

    const { rerender } = renderHook(
      ({ account }) =>
        useSessionWizardLiveRefs({
          draft: { slug: 'current-draft' },
          draftRef: refs.draftRef,
          deployForm: { workerName: 'current-worker' },
          deployFormRef: refs.deployFormRef,
          account,
          resolvedWalletAccountRef: refs.resolvedWalletAccountRef,
          deployComplete: false,
          deployCompleteRef: refs.deployCompleteRef,
          deployWorkerUrl: '',
          deployWorkerUrlRef: refs.deployWorkerUrlRef,
          provisionedSponsoredContext: { sessionSlug: '' },
          provisionedSponsoredContextRef: refs.provisionedSponsoredContextRef,
          workerSecretsEnabled: false,
          workerSecretsEnabledRef: refs.workerSecretsEnabledRef,
          persistWorkerSecrets: false,
          persistWorkerSecretsRef: refs.persistWorkerSecretsRef,
          workerSecrets: { customRpcUrl: '' },
          workerSecretsRef: refs.workerSecretsRef,
        }),
      { initialProps: { account: '' } },
    );

    expect(refs.resolvedWalletAccountRef.current).toBe('0xexisting');

    rerender({ account: ' 0xdef ' });

    expect(refs.resolvedWalletAccountRef.current).toBe('0xdef');
  });
});
