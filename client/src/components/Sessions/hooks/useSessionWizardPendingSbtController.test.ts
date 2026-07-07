import { act, renderHook } from '@testing-library/react';
import useSessionWizardPendingSbtController from './useSessionWizardPendingSbtController';
import type { PendingSbtDraft } from './usePendingSbtDrafts.js';

const PENDING_ADDRESS = '0x00000000000000000000000000000000000000a1';
const FACTORY_ADDRESS = '0x00000000000000000000000000000000000000f1';

const buildPendingDraft = (overrides: Partial<PendingSbtDraft> = {}): PendingSbtDraft => ({
  predictedAddress: PENDING_ADDRESS,
  displayName: 'Pending Access',
  tokenURI: 'ar://pending',
  deployed: false,
  ...overrides,
});

const buildGate = (id = 'gate-1', sbts: unknown[] = []) => ({
  id,
  label: id,
  sbts,
});

const applySetter = <T>(setter: jest.Mock, previous: T): T => {
  const nextValueOrUpdater = setter.mock.calls[0][0];
  return typeof nextValueOrUpdater === 'function' ? nextValueOrUpdater(previous) : nextValueOrUpdater;
};

const createControllerHarness = (overrides: Record<string, unknown> = {}) => {
  const setEncryptionGates = jest.fn();
  const setFeaturedDraftGateAutoLink = jest.fn();
  const setPendingSbtDrafts = jest.fn();
  const setStatus = jest.fn();
  const updateDraftValue = jest.fn();
  const closeCreateSbtModal = jest.fn();
  const notifySuccess = jest.fn();
  const resolveCreateSbtTargetGateId = jest.fn((gateId: unknown = '') => String(gateId || 'gate-1'));
  const draftRef = {
    current: {
      networkChainId: 11155420,
      contracts: {
        sbtFactory: {
          address: FACTORY_ADDRESS,
        },
      },
      defaultFeaturedSBTs: [],
    },
  };
  const allEncryptionGates = [buildGate('gate-1'), buildGate('gate-2')];
  const hook = renderHook(() =>
    useSessionWizardPendingSbtController({
      allEncryptionGates,
      createSbtModalState: {
        targetType: 'gate',
        gateId: 'gate-2',
      },
      draftDefaultFeaturedSBTs: draftRef.current.defaultFeaturedSBTs,
      draftRef,
      encryptionGates: allEncryptionGates,
      featuredDraftGateAutoLink: null,
      network: { id: 11155420 },
      pendingSbtDeployContextSignature: `11155420|${FACTORY_ADDRESS}`,
      pendingSbtDrafts: [],
      registryChainId: 11155420,
      closeCreateSbtModal,
      resolveCreateSbtTargetGateId,
      setEncryptionGates,
      setFeaturedDraftGateAutoLink,
      setPendingSbtDrafts,
      setStatus,
      updateDraftValue,
      notifySuccess,
      ...overrides,
    }),
  );

  return {
    ...hook,
    closeCreateSbtModal,
    notifySuccess,
    resolveCreateSbtTargetGateId,
    setEncryptionGates,
    setFeaturedDraftGateAutoLink,
    setPendingSbtDrafts,
    setStatus,
    updateDraftValue,
  };
};

describe('useSessionWizardPendingSbtController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds selector options from normalized pending drafts', () => {
    const { result } = createControllerHarness({
      pendingSbtDrafts: [
        buildPendingDraft(),
        buildPendingDraft({ predictedAddress: PENDING_ADDRESS.toUpperCase(), displayName: 'Duplicate' }),
      ],
    });

    expect(result.current.pendingSbtSelectorOptions).toEqual([
      expect.objectContaining({
        address: PENDING_ADDRESS,
        name: 'Pending Access (Pending)',
        pending: true,
      }),
    ]);
  });

  it('saves a default featured pending draft and auto-links Gate A', async () => {
    const {
      result,
      closeCreateSbtModal,
      notifySuccess,
      setEncryptionGates,
      setFeaturedDraftGateAutoLink,
      setPendingSbtDrafts,
      updateDraftValue,
    } = createControllerHarness({
      createSbtModalState: {
        targetType: 'defaultFeaturedSBTs',
        gateId: 'gate-1',
      },
    });

    await act(async () => {
      await result.current.handleSavePendingSbtDraft(buildPendingDraft());
    });

    expect(applySetter(setPendingSbtDrafts, [])).toEqual([
      expect.objectContaining({
        predictedAddress: PENDING_ADDRESS,
        deployed: false,
        networkChainId: 11155420,
        sbtFactoryAddress: FACTORY_ADDRESS,
        deploymentContextSignature: `11155420|${FACTORY_ADDRESS}`,
      }),
    ]);
    expect(updateDraftValue).toHaveBeenCalledWith(
      ['defaultFeaturedSBTs'],
      expect.arrayContaining([
        expect.objectContaining({
          address: PENDING_ADDRESS,
          pending: true,
        }),
      ]),
    );
    expect(applySetter(setEncryptionGates, [buildGate('gate-1')])).toEqual([
      expect.objectContaining({
        id: 'gate-1',
        sbts: expect.arrayContaining([
          expect.objectContaining({
            address: PENDING_ADDRESS,
            pending: true,
          }),
        ]),
      }),
    ]);
    expect(setFeaturedDraftGateAutoLink).toHaveBeenCalledWith({
      gateId: 'gate-1',
      address: PENDING_ADDRESS,
      dismissed: false,
      source: 'defaultFeaturedSBTs',
    });
    expect(notifySuccess).toHaveBeenCalledWith('Prepared Pending Access for deploy.');
    expect(closeCreateSbtModal).toHaveBeenCalledTimes(1);
  });

  it('saves a pending draft into the selected gate', async () => {
    const { result, resolveCreateSbtTargetGateId, setEncryptionGates, setFeaturedDraftGateAutoLink } =
      createControllerHarness();

    await act(async () => {
      await result.current.handleSavePendingSbtDraft(buildPendingDraft());
    });

    expect(resolveCreateSbtTargetGateId).toHaveBeenCalledWith('gate-2');
    expect(applySetter(setEncryptionGates, [buildGate('gate-1'), buildGate('gate-2')])).toEqual([
      expect.objectContaining({ id: 'gate-1', sbts: [] }),
      expect.objectContaining({
        id: 'gate-2',
        sbts: expect.arrayContaining([
          expect.objectContaining({
            address: PENDING_ADDRESS,
            pending: true,
          }),
        ]),
      }),
    ]);
    expect(setFeaturedDraftGateAutoLink).not.toHaveBeenCalled();
  });

  it('removes pending drafts from draft state, gates, and featured auto-links', () => {
    const { result, setEncryptionGates, setFeaturedDraftGateAutoLink, setPendingSbtDrafts, updateDraftValue } =
      createControllerHarness();

    act(() => {
      result.current.removePendingSbtDraft(PENDING_ADDRESS);
    });

    expect(applySetter(setPendingSbtDrafts, [buildPendingDraft()])).toEqual([]);
    expect(
      applySetter(setEncryptionGates, [buildGate('gate-1', [{ address: PENDING_ADDRESS, pending: true }])])[0].sbts,
    ).toEqual([]);
    expect(updateDraftValue).toHaveBeenCalledWith(['defaultFeaturedSBTs'], []);
    expect(
      setFeaturedDraftGateAutoLink.mock.calls[0][0]({
        gateId: 'gate-1',
        address: PENDING_ADDRESS,
        dismissed: false,
        source: 'defaultFeaturedSBTs',
      }),
    ).toBeNull();
  });

  it('promotes deployed pending selections before publish clears drafts', () => {
    const { result, setEncryptionGates, setFeaturedDraftGateAutoLink, updateDraftValue } = createControllerHarness({
      draftRef: {
        current: {
          defaultFeaturedSBTs: [{ address: PENDING_ADDRESS, name: 'Pending Access (Pending)', pending: true }],
        },
      },
    });

    act(() => {
      result.current.promoteDeployedPendingSbtSelections([
        buildPendingDraft({
          deployedAddress: PENDING_ADDRESS,
          deployed: true,
        }),
      ]);
    });

    expect(
      applySetter(setEncryptionGates, [
        buildGate('gate-1', [{ address: PENDING_ADDRESS, name: 'Pending Access (Pending)', pending: true }]),
      ])[0].sbts,
    ).toEqual([
      expect.objectContaining({
        address: PENDING_ADDRESS,
        name: 'Pending Access',
      }),
    ]);
    expect(updateDraftValue).toHaveBeenCalledWith(['defaultFeaturedSBTs'], expect.arrayContaining([PENDING_ADDRESS]));
    expect(
      setFeaturedDraftGateAutoLink.mock.calls[0][0]({
        gateId: 'gate-1',
        address: PENDING_ADDRESS,
        dismissed: false,
        source: 'defaultFeaturedSBTs',
      }),
    ).toBeNull();
  });

  it('clears selected pending drafts and records the status message', () => {
    const { result, setPendingSbtDrafts, setStatus } = createControllerHarness();

    act(() => {
      result.current.clearPendingSbtDrafts([buildPendingDraft()], 'Pending drafts cleared.');
    });

    expect(applySetter(setPendingSbtDrafts, [buildPendingDraft()])).toEqual([]);
    expect(setStatus).toHaveBeenCalledWith('Pending drafts cleared.');
  });
});
