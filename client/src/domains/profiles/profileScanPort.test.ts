import chainGateway from '../../utilities/web3/chainGateway.js';
import { profileScanPort } from './profileScanPort';

describe('ProfileScanPort', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes user profile reads through call-time chainGateway property lookup', async () => {
    const getSBTsForUser = jest.spyOn(chainGateway, 'getSBTsForUser').mockResolvedValue([{ id: 'first-sbt' }]);
    const getUserActivity = jest
      .spyOn(chainGateway, 'getUserActivity')
      .mockResolvedValue({ data: { surveys: ['second-survey'] }, hadError: false });

    await expect(profileScanPort.getSBTsForUser('0xabc', 'alpha', 10, { returnMeta: true })).resolves.toEqual([
      { id: 'first-sbt' },
    ]);
    await expect(profileScanPort.getUserActivity('0xdef', 'beta', 20, { includeSurveys: true })).resolves.toEqual({
      data: { surveys: ['second-survey'] },
      hadError: false,
    });

    expect(getSBTsForUser).toHaveBeenCalledWith('0xabc', 'alpha', 10, { returnMeta: true });
    expect(getUserActivity).toHaveBeenCalledWith('0xdef', 'beta', 20, { includeSurveys: true });
  });
});
