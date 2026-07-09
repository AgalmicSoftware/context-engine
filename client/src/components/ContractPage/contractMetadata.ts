import { toStr } from '../../utilities/shared/primitives.js';
import { t } from '../../utilities/ui/terminology.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';

export const CONTRACT_NAME_MAPPING = Object.freeze({
  surveys: 'Questions and Surveys',
  sbtFactory: `${t('sbt')} Factory`,
  sessionRegistry: 'Session Registry',
  customSBT: `Custom ${t('sbt')} (Template)`,
});

export const CONTRACT_EXPLAINERS = Object.freeze({
  surveys: 'Keeps track of questions / surveys (+ responses) storage hashes on Arweave.',
  sbtFactory: `Allows anyone to easily create ${t('sbtFull')}s (Non-transferrable NFTs) to signify event participation, ${t('sbtLower')} membership, or public belief / association.`,
  sessionRegistry:
    'On-chain registry mapping session slugs to their contract addresses and configuration. One per chain.',
  customSBT: `${t('sbtFull')} contract template deployed by ${t('sbt')} Factory for each ${t('sbtLower')}. Non-transferable ERC-721.`,
});

export const CONTRACT_SOURCE_FILES = Object.freeze({
  surveys: 'Surveys.sol',
  sbtFactory: 'SBTFactory.sol',
  sessionRegistry: 'SessionRegistry.sol',
  customSBT: 'CustomSBT.sol',
});

export const SUPPORTED_CONTRACT_KEYS = Object.freeze(['surveys', 'sbtFactory', 'sessionRegistry', 'customSBT']);

export const CONTRACT_VIEWER_SECTION_TESTID = 'ce-contract-viewer-section';
export const CONTRACT_VIEWER_TOGGLE_TESTID = 'ce-contract-viewer-toggle';
export const WIZARD_CONTRACT_MODAL_TESTID = 'ce-wizard-contract-modal';

export const normalizeContractKeyParam = (value = ''): string => {
  const normalized = toStr(value).trim();
  return SUPPORTED_CONTRACT_KEYS.includes(normalized) ? normalized : '';
};

export const getContractDisplayName = (contractKey = ''): string =>
  (CONTRACT_NAME_MAPPING as Record<string, string>)[contractKey] || contractKey;

export const getContractExplainer = (contractKey = ''): string =>
  (CONTRACT_EXPLAINERS as Record<string, string>)[contractKey] || `Core contract for ${contractKey}.`;

export const getContractSourceFileName = (contractKey = ''): string =>
  (CONTRACT_SOURCE_FILES as Record<string, string>)[contractKey] || '';

export const getContractSourcePanelId = (contractKey = ''): string => `contract-source-${contractKey}`;
export const getContractViewerCardTestId = (contractKey = ''): string => `ce-contract-viewer-card-${contractKey}`;
export const getContractViewerSourceTestId = (contractKey = ''): string => `ce-contract-viewer-source-${contractKey}`;
export const getSessionWizardContractRowTestId = (contractKey = ''): string => `ce-wizard-contract-row-${contractKey}`;
export const getSessionWizardContractTooltipTestId = (contractKey = ''): string =>
  `ce-wizard-contract-tooltip-${contractKey}`;
export const getSessionWizardContractModalTriggerTestId = (contractKey = ''): string =>
  `ce-wizard-contract-modal-trigger-${contractKey}`;

type ContractsPageHrefOptions = {
  contractKey?: unknown;
  sessionSlug?: unknown;
};

export const buildContractsPageHref = ({
  contractKey = '',
  sessionSlug = '',
}: ContractsPageHrefOptions = {}): string => {
  const normalizedContractKey = normalizeContractKeyParam(toStr(contractKey));
  const normalizedSessionSlug = toStr(sessionSlug).trim();
  const searchParams = new URLSearchParams();

  if (normalizedContractKey) searchParams.set('contract', normalizedContractKey);
  if (normalizedSessionSlug) searchParams.set('session', normalizedSessionSlug);

  const query = searchParams.toString();
  return buildPublicRoute(query ? `/contracts?${query}` : '/contracts');
};
