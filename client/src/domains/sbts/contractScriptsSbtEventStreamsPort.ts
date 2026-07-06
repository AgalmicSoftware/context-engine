import contractScripts from '../../utilities/web3/contractScripts.js';
import type { SbtEventStreamsPort, SbtProviderRef } from './sbtPorts.js';

type SbtEventStreamsContractScripts = {
  listenForSBTEvents: (
    providerName: SbtProviderRef,
    handler: (event: unknown) => unknown,
    sessionSlug: string
  ) => unknown;
  removeSBTEventListener: (
    providerName: SbtProviderRef,
    sessionSlug: string
  ) => unknown;
  listenForSurveyEvents: (
    providerName: SbtProviderRef,
    handler: (event: unknown) => unknown,
    sessionSlug: string
  ) => unknown;
  removeSurveyEventsListener: (
    providerName: SbtProviderRef,
    sessionSlug: string
  ) => unknown;
  listenForSBTInstanceEvents: (
    providerName: SbtProviderRef,
    addresses: unknown[],
    handler: (event: unknown) => unknown,
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
  listenForSBTEvents: (providerName, handler, sessionSlug) => (
    readContractScripts().listenForSBTEvents(providerName, handler, sessionSlug)
  ),
  removeSBTEventListener: (providerName, sessionSlug) => (
    readContractScripts().removeSBTEventListener(providerName, sessionSlug)
  ),
  listenForSurveyEvents: (providerName, handler, sessionSlug) => (
    readContractScripts().listenForSurveyEvents(providerName, handler, sessionSlug)
  ),
  removeSurveyEventsListener: (providerName, sessionSlug) => (
    readContractScripts().removeSurveyEventsListener(providerName, sessionSlug)
  ),
  listenForSBTInstanceEvents: (providerName, addresses, handler, sessionSlug) => (
    readContractScripts().listenForSBTInstanceEvents(providerName, addresses, handler, sessionSlug)
  ),
  removeSBTInstanceEventsListener: (providerName, addresses, sessionSlug) => (
    readContractScripts().removeSBTInstanceEventsListener(providerName, addresses, sessionSlug)
  ),
});

export const sbtEventStreamsPort = bindSbtEventStreamsPort({
  contractScripts: () => contractScripts,
});
