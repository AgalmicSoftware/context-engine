import chainGateway from '../../utilities/web3/chainGateway.js';
import type { SbtEventStreamsPort } from './sbtPorts.js';

export const sbtEventStreamsPort: SbtEventStreamsPort = {
  listenForSBTEvents: (providerName, handler, sessionSlug) =>
    chainGateway.listenForSBTEvents(providerName, handler, sessionSlug),
  removeSBTEventListener: (providerName, sessionSlug) => chainGateway.removeSBTEventListener(providerName, sessionSlug),
  listenForSurveyEvents: (providerName, handler, sessionSlug) =>
    chainGateway.listenForSurveyEvents(providerName, handler, sessionSlug),
  removeSurveyEventsListener: (providerName, sessionSlug) =>
    chainGateway.removeSurveyEventsListener(providerName, sessionSlug),
  listenForSBTInstanceEvents: (providerName, addresses, handler, sessionSlug) =>
    chainGateway.listenForSBTInstanceEvents(providerName, addresses, handler, sessionSlug),
  removeSBTInstanceEventsListener: (providerName, addresses, sessionSlug) =>
    chainGateway.removeSBTInstanceEventsListener(providerName, addresses, sessionSlug),
};
