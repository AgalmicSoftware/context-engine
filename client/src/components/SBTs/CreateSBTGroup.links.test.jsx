import { render, screen } from '@testing-library/react';

import CreateSBTGroup from './CreateSBTGroup';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
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

describe('CreateSBTGroup success links', () => {
  afterEach(() => {
    delete window.ethereum;
    delete window.__litHooks;
    delete window.litHooks;
  });

  it('renders the open-mint URL card in the success UI for anyone-can-mint SBTs', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({ sessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      startedMinting: true,
      currentStep: 3,
      sbtMinted: true,
      sbtAddress,
      shareableUrl: `http://localhost/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
      autoJoinUrl: `http://localhost/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
      sbtDistribution: {
        ...instance.state.sbtDistribution,
        distributionOption: 'anyoneCanMint',
      },
    };

    render(instance.render());

    expect(screen.getByRole('heading', { name: 'Created' })).toBeInTheDocument();
    expect(screen.getByText('Created!')).toBeInTheDocument();
    expect(screen.getAllByText('Create').length).toBeGreaterThan(0);
    expect(screen.getByText('Contract Address:')).toBeInTheDocument();
    expect(screen.getByTitle('Copy Link to Page')).toBeInTheDocument();
    expect(screen.getByTitle('Bookmark')).toBeInTheDocument();
    expect(screen.getByTitle('Copy Address')).toBeInTheDocument();
    const openMintCard = screen.getByTestId(E2E_TESTIDS.SBT_CREATE_OPEN_MINT_URL);
    expect(openMintCard).toHaveTextContent('URL Where Anyone Can Join');
    expect(openMintCard).toHaveTextContent('/session/edge?sbt=');
  });

  it('prepends PUBLIC_URL when building the session auto-join URL', () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const sbtAddress = '0x00000000000000000000000000000000000000b1';
      const instance = makeInstance({ sessionSlug: 'edge' });

      expect(instance.buildSessionAutoJoinUrl(sbtAddress)).toBe(
        `http://localhost/ce/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
      );
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('canonicalizes reserved session aliases when building the session auto-join URL', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';

    expect(makeInstance({ sessionSlug: 'general' }).buildSessionAutoJoinUrl(sbtAddress)).toBe(
      `http://localhost/session?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );
    expect(makeInstance({ sessionSlug: 'debate' }).buildSessionAutoJoinUrl(sbtAddress)).toBe(
      `http://localhost/session/debate?sbt=${encodeURIComponent(sbtAddress)}&auto=1`,
    );
  });

  it('builds session-hinted SBT detail page paths when a session slug is known', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';

    expect(makeInstance({ sessionSlug: 'edge' }).buildSbtPagePath(sbtAddress)).toBe(
      buildSbtDetailPath(sbtAddress, 'edge'),
    );
    expect(makeInstance({ sessionSlug: 'general' }).buildSbtPagePath(sbtAddress)).toBe(buildSbtDetailPath(sbtAddress));
  });

  it('renders the success page link with the resolved session hint', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({ sessionSlug: 'edge' });
    instance.state = {
      ...instance.state,
      startedMinting: true,
      sbtMinted: true,
      sbtAddress,
    };

    render(instance.render());

    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS_PAGE_LINK)).toHaveAttribute(
      'href',
      buildSbtDetailPath(sbtAddress, 'edge'),
    );
    expect(screen.getByTestId(E2E_TESTIDS.SBT_CREATE_SUCCESS_PAGE_LINK)).toHaveAttribute(
      'title',
      'Open Page in New Tab',
    );
    expect(screen.getByText(`Page (${sbtAddress})`)).toBeInTheDocument();
  });

  it('canonicalizes reserved session aliases when building limited invite links', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const encodedPassword = encodeURIComponent(cryptoUtils.encodeGroupPasswordForUrl('shared-secret'));
    const buildInviteInstance = (sessionSlug) => {
      const instance = makeInstance({ sessionSlug });
      instance.state = {
        ...instance.state,
        sbtDistribution: {
          ...instance.state.sbtDistribution,
          isLimited: true,
          distributionOption: 'groupPassword',
        },
      };
      return instance;
    };

    const generalInstance = buildInviteInstance('general');
    await generalInstance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);
    expect(generalInstance.state.sbtInviteLinks).toEqual([
      `http://localhost/session?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodedPassword}`,
    ]);

    const debateInstance = buildInviteInstance('debate');
    await debateInstance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);
    expect(debateInstance.state.sbtInviteLinks).toEqual([
      `http://localhost/session/debate?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodedPassword}`,
    ]);
  });

  it('prepends PUBLIC_URL when generating limited group-password invite links', async () => {
    const previousPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';

    try {
      const sbtAddress = '0x00000000000000000000000000000000000000b1';
      const encodedPassword = encodeURIComponent(cryptoUtils.encodeGroupPasswordForUrl('shared-secret'));
      const instance = makeInstance({ sessionSlug: 'edge' });
      instance.state = {
        ...instance.state,
        sbtDistribution: {
          ...instance.state.sbtDistribution,
          isLimited: true,
          distributionOption: 'groupPassword',
        },
      };

      await instance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);

      expect(instance.state.sbtInviteLinks).toEqual([
        `http://localhost/ce/session/edge?auto=1&sbt=${encodeURIComponent(sbtAddress)}&gp=${encodedPassword}`,
      ]);
    } finally {
      if (previousPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = previousPublicUrl;
    }
  });

  it('builds unlimited invite links with session-hinted SBT detail paths', async () => {
    const sbtAddress = '0x00000000000000000000000000000000000000b1';
    const instance = makeInstance({ sessionSlug: 'edge' });
    const expectedInvitePath = buildSbtDetailPath(sbtAddress, 'edge').replace(
      /\?session=edge$/,
      '/shared-secret?session=edge',
    );

    await instance.generateSBTInviteLinks(sbtAddress, ['shared-secret']);

    expect(instance.state.sbtInviteLinks).toEqual([`http://localhost${expectedInvitePath}`]);
  });
});
