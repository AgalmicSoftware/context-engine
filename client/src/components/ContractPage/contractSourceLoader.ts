/* eslint-disable import/no-webpack-loader-syntax */

import { CONTRACT_SOURCE_FILES } from './contractMetadata.js';

export const getContractSourceDefinitions = (): Record<string, { file: string; source: any }> => ({
  surveys: {
    file: CONTRACT_SOURCE_FILES.surveys,
    source: require('!!raw-loader!../../../../contracts/Surveys.sol').default,
  },
  sbtFactory: {
    file: CONTRACT_SOURCE_FILES.sbtFactory,
    source: require('!!raw-loader!../../../../contracts/SBTFactory.sol').default,
  },
  sessionRegistry: {
    file: CONTRACT_SOURCE_FILES.sessionRegistry,
    source: require('!!raw-loader!../../../../contracts/SessionRegistry.sol').default,
  },
  customSBT: {
    file: CONTRACT_SOURCE_FILES.customSBT,
    source: require('!!raw-loader!../../../../contracts/CustomSBT.sol').default,
  },
});
