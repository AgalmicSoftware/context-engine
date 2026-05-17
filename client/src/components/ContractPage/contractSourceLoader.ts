import { CONTRACT_SOURCE_FILES } from './contractMetadata.js';
import surveysSource from '!!raw-loader!../../../../contracts/Surveys.sol';
import sbtFactorySource from '!!raw-loader!../../../../contracts/SBTFactory.sol';
import sessionRegistrySource from '!!raw-loader!../../../../contracts/SessionRegistry.sol';
import customSbtSource from '!!raw-loader!../../../../contracts/CustomSBT.sol';

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
