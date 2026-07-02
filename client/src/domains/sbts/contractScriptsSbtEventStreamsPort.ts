import contractScripts from '../../utilities/web3/contractScripts.js';
import type { SbtEventStreamsPort, SbtProviderRef } from './sbtPorts.js';

type SbtEventStreamsContractScripts = {
  removeSBTEventListener: (
    providerName: SbtProviderRef,
    sessionSlug: string
  ) => unknown;
  removeSurveyEventsListener: (
    providerName: SbtProviderRef,
    sessionSlug: string
  ) => unknown;
  removeSBTInstanceEventsListener: (
    providerName: SbtProviderRef,
    addresses: unknown[],
    sessionSlug: string
  ) => unknown;
};

type BindSbtEventStreamsPortArgs = {
  contractScripts: () => SbtEventStreamsContractScripts;
};

export const bindSbtEventStreamsPort = ({
  contractScripts: readContractScripts,
}: BindSbtEventStreamsPortArgs): SbtEventStreamsPort => ({
  removeSBTEventListener: (providerName, sessionSlug) => (
    readContractScripts().removeSBTEventListener(providerName, sessionSlug)
  ),
  removeSurveyEventsListener: (providerName, sessionSlug) => (
    readContractScripts().removeSurveyEventsListener(providerName, sessionSlug)
  ),
  removeSBTInstanceEventsListener: (providerName, addresses, sessionSlug) => (
    readContractScripts().removeSBTInstanceEventsListener(providerName, addresses, sessionSlug)
  ),
});

export const sbtEventStreamsPort = bindSbtEventStreamsPort({
  contractScripts: () => contractScripts,
});
