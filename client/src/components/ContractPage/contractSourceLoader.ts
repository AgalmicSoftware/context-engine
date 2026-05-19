import { CONTRACT_SOURCE_FILES } from './contractMetadata.js';
import surveysSource from '../../../../contracts/Surveys.sol?raw';
import sbtFactorySource from '../../../../contracts/SBTFactory.sol?raw';
import sessionRegistrySource from '../../../../contracts/SessionRegistry.sol?raw';
import customSbtSource from '../../../../contracts/CustomSBT.sol?raw';

export const getContractSourceDefinitions = (): Record<string, { file: string; source: string }> => ({
  surveys: {
    file: CONTRACT_SOURCE_FILES.surveys,
    source: surveysSource,
  },
  sbtFactory: {
    file: CONTRACT_SOURCE_FILES.sbtFactory,
    source: sbtFactorySource,
  },
  sessionRegistry: {
    file: CONTRACT_SOURCE_FILES.sessionRegistry,
    source: sessionRegistrySource,
  },
  customSBT: {
    file: CONTRACT_SOURCE_FILES.customSBT,
    source: customSbtSource,
  },
});
