import * as sponsoredAccessModule from '../../utilities/web3/sponsoredAccess.js';
import { checkSponsoredAccess } from './sponsoredAccess.js';

jest.mock('../../utilities/web3/sponsoredAccess.js', () => ({
  __esModule: true,
  checkSponsoredAccess: jest.fn(async (input) => ({
    status: 'granted',
    gate: null,
    resourceKey: input?.resourceKey || 'ai',
  })),
}));

const mockedSponsoredAccess = sponsoredAccessModule as jest.Mocked<typeof sponsoredAccessModule>;

describe('sponsoredAccess domain adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates sponsored access checks through the shared utility module', async () => {
    const input = {
      sessionSlug: 'alpha',
      account: '0x0000000000000000000000000000000000000002',
      resourceKey: 'ai' as const,
    };

    await expect(checkSponsoredAccess(input)).resolves.toEqual({
      status: 'granted',
      gate: null,
      resourceKey: 'ai',
    });

    expect(mockedSponsoredAccess.checkSponsoredAccess).toHaveBeenCalledWith(input);
  });
});
