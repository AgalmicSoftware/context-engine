/** naming-migration alias, remove per PRD 653/654. */
export {
  buildArweaveReadModeTag,
  buildDecryptModeTag,
  buildFailureModeTag,
  createChainMetadataResolutionHelpers,
  createChainMetadataResolutionHelpers as createContractScriptsMetadataResolutionHelpers,
} from './chainMetadataResolution.js';
export type { MetadataReadOptions } from './chainMetadataResolution.js';
