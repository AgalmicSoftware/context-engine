import { bindProfileScanPort } from './profileScanPort';

describe('ProfileScanPort', () => {
  it('routes user profile reads through call-time chainGateway lookup', async () => {
    const firstChainGateway = {
      getSBTsForUser: jest.fn(async () => [{ id: 'first-sbt' }]),
      getUserActivity: jest.fn(async () => ({ surveys: ['first-survey'] })),
    };
    const secondChainGateway = {
      getSBTsForUser: jest.fn(async () => ({ data: [{ id: 'second-sbt' }], hadError: false })),
      getUserActivity: jest.fn(async () => ({ data: { surveys: ['second-survey'] }, hadError: false })),
    };
    let currentChainGateway = firstChainGateway;
    const port = bindProfileScanPort({
      chainGateway: () => currentChainGateway,
    });

    await expect(port.getSBTsForUser('0xabc', 'alpha', 10, { returnMeta: true })).resolves.toEqual([
      { id: 'first-sbt' },
    ]);

    currentChainGateway = secondChainGateway;

    await expect(port.getUserActivity('0xdef', 'beta', 20, { includeSurveys: true })).resolves.toEqual({
      data: { surveys: ['second-survey'] },
      hadError: false,
    });

    expect(firstChainGateway.getSBTsForUser).toHaveBeenCalledWith('0xabc', 'alpha', 10, { returnMeta: true });
    expect(secondChainGateway.getUserActivity).toHaveBeenCalledWith('0xdef', 'beta', 20, { includeSurveys: true });
  });
});
