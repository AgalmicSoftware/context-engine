import {
  act,
  contractScripts,
  E2E_TESTIDS,
  ethers,
  fireEvent,
  makeFactoryReceiptLog,
  makeInstance,
  render,
  screen,
  setupCreateSBTGroupTestLifecycle,
  within,
} from './CreateSBTGroup.testUtils';

const PASSPHRASE_PATTERN = /^[a-z]+(-[a-z]+){4}$/;

const makeGroupPasswordInstance = (stateOverrides = {}, props = {}) => {
  const instance = makeInstance({
    account: '0x1111111111111111111111111111111111111111',
    loginComplete: true,
    network: { id: 84532, name: 'Base Sepolia' },
    provider: 'mock-provider',
    sessionSlug: 'test',
    toggleLoginModal: jest.fn(),
    ...props,
  });
  instance.state = {
    ...instance.state,
    sbtName: 'Password Group',
    distributionOptionsCollapsed: false,
    sbtDistribution: {
      ...instance.state.sbtDistribution,
      burnAuth: 'AdminOnly',
      distributionOption: 'groupPassword',
    },
    ...stateOverrides,
  };
  return instance;
};

const stubCreateUploads = (instance) => {
  instance.commitPendingDocumentUrl = jest.fn(async () => false);
  instance.uploadImageToArweave = jest.fn(async () => null);
  instance.uploadTokenUriToArweave = jest.fn(async () => null);
  instance.mintSBT = jest.fn(async () => null);
};

const PASSPHRASE = 'orbit-maple-signal-tunnel-quartz';
const PREDICTED = '0x00000000000000000000000000000000000000c9';

// A full create: only the uploads, the address prediction and the deploy are stubbed.
const makeCreatingInstance = (stateOverrides = {}, props = {}) => {
  const instance = makeGroupPasswordInstance({ groupPassword: PASSPHRASE, ...stateOverrides }, props);
  instance.persistFormCache = jest.fn();
  instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
  instance.commitPendingDocumentUrl = jest.fn(async () => false);
  instance.uploadImageToArweave = jest.fn(async () => null);
  instance.uploadTokenUriToArweave = jest.fn(async () => {
    instance.state = { ...instance.state, tokenURI: 'ar://metadata' };
    return 'ar://metadata';
  });
  jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(PREDICTED);
  jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
    logs: [makeFactoryReceiptLog('SBTCreated', [PREDICTED])],
  });
  return instance;
};

describe('CreateSBTGroup group password', () => {
  setupCreateSBTGroupTestLifecycle();

  it('prefills a generated passphrase when group-password minting is chosen', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: '' });
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution, distributionOption: 'anyoneCanMint' },
    };

    instance.componentDidUpdate(instance.props, prevState);

    expect(instance.state.groupPassword).toMatch(PASSPHRASE_PATTERN);
    instance.state.groupPassword
      .split('-')
      .forEach((word) => expect(ethers.wordlists.en.getWordIndex(word)).toBeGreaterThanOrEqual(0));
  });

  it('keeps a password the creator already entered', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'my-own-long-group-password' });
    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution, distributionOption: 'anyoneCanMint' },
    };

    instance.componentDidUpdate(instance.props, prevState);

    expect(instance.state.groupPassword).toBe('my-own-long-group-password');
  });

  it('replaces the password with a new passphrase from "Generate new"', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'short', groupPasswordWeakConfirmed: true });
    jest.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => array.fill(7));

    render(instance.render());
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE));

    expect(instance.state.groupPassword).toBe(Array(5).fill(ethers.wordlists.en.getWord(7)).join('-'));
    expect(instance.state.groupPasswordWeakConfirmed).toBe(false);
  });

  it('shows no short-password warning for a generated passphrase', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'orbit-maple-signal-tunnel-quartz' });

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT)).toHaveValue(
      'orbit-maple-signal-tunnel-quartz',
    );
    expect(screen.queryByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_WARNING)).not.toBeInTheDocument();
  });

  it('warns about short custom passwords and blocks creating until the risk is confirmed', async () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'short-secret' });
    stubCreateUploads(instance);

    const view = render(instance.render());
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_WARNING)).toHaveTextContent(
      /public on-chain, so a password shorter than 16 characters can be guessed offline/,
    );
    const confirm = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_CONFIRM);
    expect(confirm).not.toBeChecked();

    await act(async () => {
      await instance.handleMintClick();
    });
    expect(instance.mintSBT).not.toHaveBeenCalled();
    expect(instance.state.error).toMatch(/short group password/);

    fireEvent.click(confirm);
    expect(instance.state.groupPasswordWeakConfirmed).toBe(true);
    view.rerender(instance.render());
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_CONFIRM)).toBeChecked();

    await act(async () => {
      await instance.handleMintClick();
    });
    expect(instance.mintSBT).toHaveBeenCalledTimes(1);
  });

  it('clears the short-password confirmation when the password changes', () => {
    const instance = makeGroupPasswordInstance({ groupPassword: 'short-secret', groupPasswordWeakConfirmed: true });
    instance.persistFormCache = jest.fn();

    instance.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'other-secret' } });

    expect(instance.state.groupPassword).toBe('other-secret');
    expect(instance.state.groupPasswordWeakConfirmed).toBe(false);
  });

  it('deploys group passwords to the predicted address even when predictable deployment is off', async () => {
    const predictedAddress = '0x00000000000000000000000000000000000000c7';
    const instance = makeGroupPasswordInstance({
      groupPassword: 'orbit-maple-signal-tunnel-quartz',
      tokenURI: 'ar://metadata',
      predictableAddressEnabled: false,
      create2Salt: '',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    const countSpy = jest.spyOn(contractScripts, 'countSBTCreated').mockResolvedValue(3);
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(predictedAddress);
    const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockResolvedValue(`0x${'66'.repeat(32)}`);
    const createSpy = jest.spyOn(contractScripts, 'createSBT').mockResolvedValue({
      logs: [makeFactoryReceiptLog('SBTCreated', [predictedAddress])],
    });

    await instance.mintSBT();

    expect(countSpy).not.toHaveBeenCalled();
    expect(hashSpy).toHaveBeenCalledWith({
      password: 'orbit-maple-signal-tunnel-quartz',
      sbtAddress: predictedAddress,
    });
    const createArgs = createSpy.mock.calls[0];
    expect(createArgs[10]).toBe(`0x${'66'.repeat(32)}`);
    expect(createArgs[12]).toBe(instance.buildAutoCreate2SaltSource());
    expect(createArgs[13]).toEqual({ useConfiguredDeterministic: true, initializeGroupPasswordHash: true });
    expect(instance.state.sbtAddress.toLowerCase()).toBe(predictedAddress);
  });

  it('shows "Securing password…" on the create button while the hash is derived', async () => {
    const predictedAddress = '0x00000000000000000000000000000000000000c8';
    const instance = makeGroupPasswordInstance({
      groupPassword: 'orbit-maple-signal-tunnel-quartz',
      create2Salt: 'test/password-group',
    });
    instance.getSessionConfigForNetwork = jest.fn(() => ({ slug: 'test', networkChainId: 84532 }));
    jest.spyOn(contractScripts, 'predictSBTAddress').mockResolvedValue(predictedAddress);
    const labelsDuringDerivation = [];
    jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockImplementation(async () => {
      render(instance.render());
      labelsDuringDerivation.push(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUBMIT).textContent);
      return `0x${'77'.repeat(32)}`;
    });

    const plan = await instance.resolvePredictableDeployPlan({ tokenURI: 'ar://metadata' });

    expect(plan.finalGroupPasswordHash).toBe(`0x${'77'.repeat(32)}`);
    expect(labelsDuringDerivation).toEqual(['Securing password…']);
    expect(instance.state.groupPasswordSecuring).toBe(false);
  });

  describe('while a create is in flight', () => {
    it.each([
      ['while "Securing password…" shows', 'computeGroupPasswordHash'],
      ['while the wallet prompt is open', 'createSBT'],
    ])('locks the password and Generate new %s, and shows the deployed password afterwards', async (_moment, step) => {
      const instance = makeCreatingInstance();
      const results = {
        computeGroupPasswordHash: `0x${'66'.repeat(32)}`,
        createSBT: { logs: [makeFactoryReceiptLog('SBTCreated', [PREDICTED])] },
      };
      let lockedDuringCreate = null;
      for (const method of Object.keys(results)) {
        jest.spyOn(contractScripts, method).mockImplementation(async () => {
          if (method === step) {
            render(instance.render());
            const input = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT);
            const generate = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE);
            lockedDuringCreate = input.disabled && generate.disabled;
            fireEvent.click(generate);
            instance.handleGenerateGroupPassword();
          }
          return results[method];
        });
      }

      // Not wrapped in act(): React would defer the render inside the create until act() ends.
      await instance.handleMintClick();

      expect(lockedDuringCreate).toBe(true);
      expect(contractScripts.computeGroupPasswordHash).toHaveBeenCalledWith({
        password: PASSPHRASE,
        sbtAddress: PREDICTED,
      });
      expect(instance.state.sbtMinted).toBe(true);
      expect(instance.state.groupPassword).toBe(PASSPHRASE);
    });

    it('locks the distribution choice and Clear, since the create reads them as it runs', async () => {
      const instance = makeCreatingInstance();
      jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockResolvedValue(`0x${'66'.repeat(32)}`);
      let controlsDuringCreate = null;
      contractScripts.createSBT.mockImplementation(async () => {
        const view = render(instance.render());
        controlsDuringCreate = {
          modes: [...view.container.querySelectorAll('input[name="sbtDistribution.distributionOption"]')].map(
            (radio) => radio.disabled,
          ),
          clear: screen.getByTitle('Clear all fields and reset to defaults').disabled,
        };
        view.unmount();
        return { logs: [makeFactoryReceiptLog('SBTCreated', [PREDICTED])] };
      });

      await instance.handleMintClick();

      expect(controlsDuringCreate).toEqual({ modes: [true, true, true], clear: true });
      expect(instance.state.sbtMinted).toBe(true);
      expect(instance.state.sbtDistribution.distributionOption).toBe('groupPassword');
    });

    it('deploys the password captured at Create even if the field changes during the upload', async () => {
      const instance = makeCreatingInstance();
      instance.uploadImageToArweave = jest.fn(async () => {
        instance.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'abc' } });
      });
      const hashSpy = jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockResolvedValue(`0x${'66'.repeat(32)}`);

      await act(async () => {
        await instance.handleMintClick();
      });

      expect(hashSpy).toHaveBeenCalledTimes(1);
      expect(hashSpy).toHaveBeenCalledWith({ password: PASSPHRASE, sbtAddress: PREDICTED });
      expect(contractScripts.createSBT).toHaveBeenCalledTimes(1);
      expect(instance.state.groupPassword).toBe(PASSPHRASE);
    });

    it('saves a deferred draft with the password captured at Create', async () => {
      const onSaveDraft = jest.fn().mockResolvedValue(undefined);
      const instance = makeCreatingInstance(
        { tokenURI: 'ar://metadata', create2Salt: 'test/password-group' },
        { deferredDeploy: true, onSaveDraft },
      );
      jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockImplementation(async () => {
        instance.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'abc' } });
        return `0x${'77'.repeat(32)}`;
      });

      await act(async () => {
        await instance.handleMintClick();
      });

      expect(onSaveDraft).toHaveBeenCalledWith(
        expect.objectContaining({ groupPassword: PASSPHRASE, finalGroupPasswordHash: `0x${'77'.repeat(32)}` }),
      );
      expect(instance.state.groupPassword).toBe(PASSPHRASE);
    });
  });

  describe('when a create stops early', () => {
    it('unlocks the form and Create when the create stops for a login', async () => {
      const instance = makeCreatingInstance({}, { loginComplete: false });

      await act(async () => {
        await instance.handleMintClick();
      });

      expect(instance.props.toggleLoginModal).toHaveBeenCalledWith(true);
      expect(contractScripts.createSBT).not.toHaveBeenCalled();
      render(instance.render());
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT)).toBeEnabled();
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE)).toBeEnabled();
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUBMIT)).toBeEnabled();
    });
  });

  describe('after a successful create', () => {
    const createGroup = async () => {
      const instance = makeCreatingInstance();
      jest.spyOn(contractScripts, 'computeGroupPasswordHash').mockResolvedValue(`0x${'66'.repeat(32)}`);
      await act(async () => {
        await instance.handleMintClick();
      });
      expect(instance.state.sbtMinted).toBe(true);
      return instance;
    };

    it('keeps the deployed password locked and shows it in the success panel to share', async () => {
      const instance = await createGroup();
      const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

      try {
        const view = render(instance.render());
        const generate = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE);
        expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT)).toBeDisabled();
        expect(generate).toBeDisabled();
        fireEvent.click(generate);
        instance.handleGenerateGroupPassword();
        view.rerender(instance.render());

        expect(instance.state.groupPassword).toBe(PASSPHRASE);
        const success = within(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS));
        expect(success.getByText(PASSPHRASE)).toBeInTheDocument();
        expect(success.getByText(/Share it separately from the claim link/)).toBeInTheDocument();
        fireEvent.click(success.getByRole('button', { name: 'Copy group password' }));
        expect(writeText).toHaveBeenCalledWith(PASSPHRASE);
      } finally {
        if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
        else delete navigator.clipboard;
      }
    });

    it('unlocks the password once the creator edits the form or starts fresh', async () => {
      const edited = await createGroup();
      edited.handleInputChange({ target: { name: 'sbtName', type: 'text', value: 'Next Group' } });
      render(edited.render());
      expect(screen.queryByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS)).not.toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT)).toBeEnabled();
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_INPUT)).toHaveValue(PASSPHRASE);

      const fresh = await createGroup();
      fresh.resetForm();
      expect(fresh.state.sbtMinted).toBe(false);
      expect(fresh.isGroupPasswordLocked()).toBe(false);
    });

    it('does not offer a limited group password for sharing, since it signs invite codes', () => {
      const instance = makeGroupPasswordInstance({
        groupPassword: PASSPHRASE,
        sbtMinted: true,
        sbtAddress: PREDICTED,
        sbtDistribution: {
          ...makeGroupPasswordInstance().state.sbtDistribution,
          isLimited: true,
          limitedNumber: 2,
        },
      });

      render(instance.render());

      const success = within(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS));
      expect(success.queryByText(PASSPHRASE)).not.toBeInTheDocument();
      expect(success.queryByRole('button', { name: 'Copy group password' })).not.toBeInTheDocument();
      expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_GROUP_PASSWORD_GENERATE)).toBeDisabled();
    });
  });

  describe('after restoring a cached form', () => {
    const NOTICE = 'A new passphrase was generated; the previous one was not saved.';

    const restoreGroupPasswordForm = () => {
      const instance = makeInstance({
        account: '0x1111111111111111111111111111111111111111',
        loginComplete: true,
        network: { id: 84532, name: 'Base Sepolia' },
        provider: 'mock-provider',
        sessionSlug: 'test',
        toggleLoginModal: jest.fn(),
      });
      instance.persistFormCache = jest.fn();
      const prevState = instance.state;
      instance.applyAuthoringPayload({
        sbtName: 'Password Group',
        _sessionSlug: 'test',
        sbtDistribution: { distributionOption: 'groupPassword' },
      });
      instance.componentDidUpdate(instance.props, prevState);
      instance.state = { ...instance.state, distributionOptionsCollapsed: false };
      return instance;
    };

    it('says that a new passphrase was generated because the old one was not saved', () => {
      const instance = restoreGroupPasswordForm();

      render(instance.render());

      expect(instance.state.groupPassword).toMatch(PASSPHRASE_PATTERN);
      expect(screen.getByText(NOTICE)).toBeInTheDocument();
    });

    it('drops the notice once the creator picks or types a password', () => {
      const generated = restoreGroupPasswordForm();
      generated.handleGenerateGroupPassword();
      const typed = restoreGroupPasswordForm();
      typed.handleInputChange({ target: { name: 'groupPassword', type: 'text', value: 'my-own-long-group-password' } });

      for (const instance of [generated, typed]) {
        const view = render(instance.render());
        expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
        view.unmount();
      }
    });
  });
});
