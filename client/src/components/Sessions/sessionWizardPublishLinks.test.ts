import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { buildPublishedPendingSbtLinks } from './sessionWizardPublishLinks';

const firstAddress = '0x00000000000000000000000000000000000000a1';
const secondAddress = '0x00000000000000000000000000000000000000b2';

describe('sessionWizardPublishLinks', () => {
  it('builds published pending SBT links from new deployments and resumed finalized drafts', () => {
    expect(
      buildPublishedPendingSbtLinks({
        deployedDrafts: [
          {
            predictedAddress: firstAddress,
            deployedAddress: firstAddress,
            displayName: 'Newly Deployed Group',
            deployed: true,
          },
        ],
        pendingDraftSnapshot: [
          {
            predictedAddress: firstAddress,
            deployedAddress: firstAddress,
            displayName: 'Newly Deployed Group',
            deployed: true,
          },
          {
            predictedAddress: secondAddress,
            deployedAddress: secondAddress,
            name: 'Resumed Finalized Group',
            deployed: true,
          },
        ],
        sessionSlug: 'writers-room',
      }),
    ).toEqual([
      {
        address: firstAddress,
        label: 'Newly Deployed Group',
        href: buildSbtDetailPath(firstAddress, 'writers-room'),
      },
      {
        address: secondAddress,
        label: 'Resumed Finalized Group',
        href: buildSbtDetailPath(secondAddress, 'writers-room'),
      },
    ]);
  });

  it('ignores drafts without a detail href', () => {
    expect(
      buildPublishedPendingSbtLinks({
        pendingDraftSnapshot: [
          {
            deployed: true,
            displayName: 'Missing address',
          },
        ],
        sessionSlug: 'writers-room',
      }),
    ).toEqual([]);
  });
});
