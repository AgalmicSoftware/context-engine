import chainGateway from '../../utilities/web3/contractScripts.js';
import type { SbtEventStreamsPort, SbtProviderRef } from './sbtPorts.js';

type SbtEventStreamsChainGateway = {
  listenForSBTEvents: (
    providerName: SbtProviderRef,
    handler: (event: unknown) => unknown,
    sessionSlug: string,
  ) => unknown;
  removeSBTEventListener: (providerName: SbtProviderRef, sessionSlug: string) => unknown;
  listenForSurveyEvents: (
    providerName: SbtProviderRef,
    handler: (event: unknown) => unknown,
    sessionSlug: string,
  ) => unknown;
  removeSurveyEventsListener: (providerName: SbtProviderRef, sessionSlug: string) => unknown;
  listenForSBTInstanceEvents: (
    providerName: SbtProviderRef,
    addresses: unknown[],
    handler: (event: unknown) => unknown,
    sessionSlug: string,
  ) => unknown;
  removeSBTInstanceEventsListener: (providerName: SbtProviderRef, addresses: unknown[], sessionSlug: string) => unknown;
};

type BindSbtEventStreamsPortArgs = {
  chainGateway: () => SbtEventStreamsChainGateway;
};

export const bindSbtEventStreamsPort = ({
  chainGateway: readChainGateway,
}: BindSbtEventStreamsPortArgs): SbtEventStreamsPort => ({
  listenForSBTEvents: (providerName, handler, sessionSlug) =>
    readChainGateway().listenForSBTEvents(providerName, handler, sessionSlug),
  removeSBTEventListener: (providerName, sessionSlug) =>
    readChainGateway().removeSBTEventListener(providerName, sessionSlug),
  listenForSurveyEvents: (providerName, handler, sessionSlug) =>
    readChainGateway().listenForSurveyEvents(providerName, handler, sessionSlug),
  removeSurveyEventsListener: (providerName, sessionSlug) =>
    readChainGateway().removeSurveyEventsListener(providerName, sessionSlug),
  listenForSBTInstanceEvents: (providerName, addresses, handler, sessionSlug) =>
    readChainGateway().listenForSBTInstanceEvents(providerName, addresses, handler, sessionSlug),
  removeSBTInstanceEventsListener: (providerName, addresses, sessionSlug) =>
    readChainGateway().removeSBTInstanceEventsListener(providerName, addresses, sessionSlug),
});

export const sbtEventStreamsPort = bindSbtEventStreamsPort({
  chainGateway: () => chainGateway,
});
