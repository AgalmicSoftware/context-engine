import { render, screen } from '@testing-library/react';

import CreateSBTGroup from './CreateSBTGroup';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const makeInstance = (props = {}) => {
  const instance = new CreateSBTGroup(props);
  instance.setState = (update, cb) => {
    const next = typeof update === 'function' ? update(instance.state) : update;
    instance.state = { ...instance.state, ...next };
    if (cb) cb();
  };
  return instance;
};

describe('CreateSBTGroup predictable deploy UI state', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
  });

  it('auto-enables predictable deployment with an auto salt when standalone group password is selected', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.persistFormCache = jest.fn();

    const prevState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtName: 'Alpha Group',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: false,
      create2Salt: '',
    };

    instance.componentDidUpdate(instance.props, prevState);

    expect(instance.state.predictableAddressEnabled).toBe(true);
    expect(instance.state.create2Salt).toBe(instance.buildAutoCreate2SaltSource());
    expect(instance.persistFormCache).toHaveBeenCalledTimes(1);
  });

  it('clears the auto-generated predictable deployment salt when leaving group password distribution', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.persistFormCache = jest.fn();

    const initialState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtName: 'Alpha Group',
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: false,
      create2Salt: '',
    };

    instance.componentDidUpdate(instance.props, initialState);

    expect(instance.state.predictableAddressEnabled).toBe(true);
    expect(instance.state.create2Salt).toBe(instance.buildAutoCreate2SaltSource());

    const prevGroupPasswordState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'anyoneCanMint',
      },
    };

    instance.componentDidUpdate(instance.props, prevGroupPasswordState);

    expect(instance.state.predictableAddressEnabled).toBe(false);
    expect(instance.state.create2Salt).toBe('');
    expect(instance.persistFormCache).toHaveBeenCalledTimes(2);
  });

  it('preserves manual predictable deployment salts when leaving group password distribution', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.persistFormCache = jest.fn();

    const initialState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: true,
      create2Salt: 'manual/test-salt',
    };

    instance.componentDidUpdate(instance.props, initialState);

    const prevGroupPasswordState = {
      ...instance.state,
      sbtDistribution: { ...instance.state.sbtDistribution },
    };

    instance.state = {
      ...instance.state,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'anyoneCanMint',
      },
    };

    instance.componentDidUpdate(instance.props, prevGroupPasswordState);

    expect(instance.state.predictableAddressEnabled).toBe(true);
    expect(instance.state.create2Salt).toBe('manual/test-salt');
    expect(instance.persistFormCache).toHaveBeenCalled();
  });

  it('disables the predictable-address toggle while group password distribution is selected', () => {
    const instance = makeInstance({
      network: { id: 84532, name: 'Base Sepolia' },
      sessionSlug: 'test',
    });
    instance.state = {
      ...instance.state,
      mintOptionsCollapsed: false,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'groupPassword',
      },
      predictableAddressEnabled: true,
      create2Salt: 'test/alpha-group',
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_PREDICTABLE_TOGGLE)).toBeDisabled();
  });
});
