import { buildContractViewerContracts } from './contractViewerUtils.js';

jest.mock('./contractSourceLoader.js', () => ({
  getContractSourceDefinitions: () => ({
    surveys: { file: 'Surveys.sol', source: 'contract Surveys {}' },
    sbtFactory: { file: 'SBTFactory.sol', source: 'contract SBTFactory {}' },
    sessionRegistry: { file: 'SessionRegistry.sol', source: 'contract SessionRegistry {}' },
    customSBT: { file: 'CustomSBT.sol', source: 'contract CustomSBT {}' },
  }),
}));

describe('buildContractViewerContracts', () => {
  it('adds bundled advanced contract sources without inventing Worker-session addresses', () => {
    const contracts = buildContractViewerContracts({
      sessionContracts: {},
      chainId: null,
      includeSessionRegistry: false,
      includeAdvancedSourceTemplates: true,
      includeCustomSBT: true,
    });

    expect(contracts.map(({ key }) => key)).toEqual(['surveys', 'sbtFactory', 'customSBT']);
    expect(contracts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'surveys', addresses: [], sourceFile: 'Surveys.sol' }),
        expect.objectContaining({ key: 'sbtFactory', addresses: [], sourceFile: 'SBTFactory.sol' }),
        expect.objectContaining({ key: 'customSBT', addresses: [], sourceFile: 'CustomSBT.sol' }),
      ]),
    );
  });

  it('keeps an addressed session contract instead of duplicating its source-only template', () => {
    const contracts = buildContractViewerContracts({
      sessionContracts: {
        surveys: {
          address: '0x1111111111111111111111111111111111111111',
          chainId: 11155420,
        },
      },
      chainId: 11155420,
      includeSessionRegistry: false,
      includeAdvancedSourceTemplates: true,
      includeCustomSBT: false,
    });

    expect(contracts.filter(({ key }) => key === 'surveys')).toHaveLength(1);
    expect(contracts.find(({ key }) => key === 'surveys')?.addresses).toEqual([
      expect.objectContaining({
        address: '0x1111111111111111111111111111111111111111',
        id: 11155420,
      }),
    ]);
    expect(contracts.map(({ key }) => key)).toEqual(['surveys', 'sbtFactory']);
  });
});
