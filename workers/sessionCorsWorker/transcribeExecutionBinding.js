import {
  transcribe as transcribeBoundary,
} from './transcribeExecution.js';

export const createTranscribeWithWorkerDeps = ({
  deps,
  constants,
} = {}) => (
  async (value = {}) => (
    (deps?.transcribe || transcribeBoundary)({
      ...value,
      deps: {
        json: deps?.json,
        toStr: deps?.toStr,
        readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
        isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
        safeFetch: deps?.safeFetch,
      },
      constants: {
        openAiTranscribeUrl: constants?.openAiTranscribeUrl,
      },
    })
  )
);
