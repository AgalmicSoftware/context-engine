import { bindProfileScanPort } from './contractScriptsProfileScanPort';

describe('ProfileScanPort', () => {
  it('routes user profile reads through call-time contractScripts lookup', async () => {
    const firstContractScripts = {
      getSBTsForUser: jest.fn(async () => [{ id: 'first-sbt' }]),
      getUserActivity: jest.fn(async () => ({ surveys: ['first-survey'] })),
    };
    const secondContractScripts = {
      getSBTsForUser: jest.fn(async () => ({ data: [{ id: 'second-sbt' }], hadError: false })),
      getUserActivity: jest.fn(async () => ({ data: { surveys: ['second-survey'] }, hadError: false })),
    };
    let currentContractScripts = firstContractScripts;
    const port = bindProfileScanPort({
      contractScripts: () => currentContractScripts,
    });

    await expect(port.getSBTsForUser('0xabc', 'alpha', 10, { returnMeta: true }))
      .resolves.toEqual([{ id: 'first-sbt' }]);

    currentContractScripts = secondContractScripts;

    await expect(port.getUserActivity('0xdef', 'beta', 20, { includeSurveys: true }))
      .resolves.toEqual({ data: { surveys: ['second-survey'] }, hadError: false });

    expect(firstContractScripts.getSBTsForUser).toHaveBeenCalledWith(
      '0xabc',
      'alpha',
      10,
      { returnMeta: true }
    );
    expect(secondContractScripts.getUserActivity).toHaveBeenCalledWith(
      '0xdef',
      'beta',
      20,
      { includeSurveys: true }
    );
  });
});
