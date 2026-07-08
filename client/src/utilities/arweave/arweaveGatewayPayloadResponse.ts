import {
  type ArweaveFetchError,
  type ArweaveFetchErrorKind,
  classifyStatusKind,
  createArweaveFetchError,
  createEmptyGatewayResponseError,
  inferStatusFromHtmlGatewayPayload,
  isEmptyGatewayResponseText,
  isRetryableStatus,
  looksLikeHtmlGatewayPayload,
} from './arweaveFetchErrors';

export type ArweaveGatewayPayloadResponse =
  | {
      ok: true;
      text: string;
    }
  | {
      ok: false;
      error: ArweaveFetchError;
      reason: 'empty';
      retryable: true;
      status: null;
      statusKind: 'network';
    }
  | {
      ok: false;
      error: ArweaveFetchError;
      reason: 'html-status';
      retryable: boolean;
      status: number;
      statusKind: ArweaveFetchErrorKind;
    };

export const classifyArweaveGatewayPayloadResponse = ({
  attempt = 0,
  contentType = '',
  gateway = '',
  text = '',
  txId = '',
}: {
  attempt?: unknown;
  contentType?: unknown;
  gateway?: unknown;
  text?: unknown;
  txId?: unknown;
} = {}): ArweaveGatewayPayloadResponse => {
  const normalizedText = String(text ?? '');
  const normalizedGateway = String(gateway || '');
  if (isEmptyGatewayResponseText(normalizedText)) {
    return {
      ok: false,
      reason: 'empty',
      status: null,
      statusKind: 'network',
      retryable: true,
      error: createEmptyGatewayResponseError({
        txId,
        gateway: normalizedGateway,
        attempt,
      }),
    };
  }

  const derivedStatus = looksLikeHtmlGatewayPayload({ text: normalizedText, contentType })
    ? inferStatusFromHtmlGatewayPayload(normalizedText)
    : null;
  if (derivedStatus != null) {
    const statusKind = classifyStatusKind(derivedStatus);
    const retryable = isRetryableStatus(derivedStatus);
    return {
      ok: false,
      reason: 'html-status',
      status: derivedStatus,
      statusKind,
      retryable,
      error: createArweaveFetchError({
        txId,
        status: derivedStatus,
        retryable,
        kind: statusKind,
        gateway: normalizedGateway,
        attempt,
        message: `Arweave gateway returned HTML payload (${derivedStatus})`,
      }),
    };
  }

  return { ok: true, text: normalizedText };
};
