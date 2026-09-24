import { Buffer } from 'buffer';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy';
import { fetchWorkerWithAuth } from '../worker/workerAuth';

type Config = Record<string, unknown>;
export type WorkerFieldContext = { sessionConfig?: Config; sessionSlug?: string; account?: string };
export type WorkerFieldRecipient = {
  type: 'worker-response-field-v1';
  policy: { sessionSlug: string; sessionId: string; owner: string; audience: string; context: string };
  wrapped: Record<string, unknown>;
};

const requestKey = async (action: string, body: unknown, context: WorkerFieldContext) => {
  const { sessionConfig, sessionSlug } = context;
  if (!sessionConfig || !sessionSlug || !sessionConfig.sessionId)
    throw new Error('Verified session context is required to unlock this field.');
  // The Worker target comes from the active verified session, never ciphertext.
  const workerUrl = await getCorsProxyUrlOrThrow({ sessionConfig, sessionSlug, allowDemoFallback: false });
  const response = await fetchWorkerWithAuth(
    `${String(workerUrl).replace(/\/+$/, '')}/storage/response-field-key/${action}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { sessionConfig, sessionSlug, workerUrl, allowDemoFallback: false },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Response field access denied.');
  return result;
};

export const wrapWorkerResponseFieldKey = async (
  key: Uint8Array,
  audience: string,
  fieldContext: string,
  context: WorkerFieldContext,
): Promise<WorkerFieldRecipient> => {
  const result = await requestKey(
    'wrap',
    {
      key: Buffer.from(key).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      audience,
      context: fieldContext,
    },
    context,
  );
  const recipient = result.recipient;
  if (
    recipient?.type !== 'worker-response-field-v1' ||
    recipient.policy?.context !== fieldContext ||
    recipient.policy?.audience !== audience ||
    recipient.policy?.sessionSlug !== context.sessionSlug ||
    recipient.policy?.sessionId !== context.sessionConfig?.sessionId ||
    recipient.policy?.owner !== context.account?.toLowerCase()
  )
    throw new Error('Worker returned a mismatched field policy.');
  return recipient;
};

export const unwrapWorkerResponseFieldKey = async (
  recipient: WorkerFieldRecipient,
  fieldContext: string,
  context: WorkerFieldContext,
): Promise<Uint8Array> => {
  if (
    recipient.policy?.context !== fieldContext ||
    recipient.policy?.sessionSlug !== context.sessionSlug ||
    recipient.policy?.sessionId !== context.sessionConfig?.sessionId
  )
    throw new Error('Response field belongs to a different session.');
  const result = await requestKey('unwrap', { recipient, context: fieldContext }, context);
  if (typeof result.key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.key))
    throw new Error('Worker returned an invalid field key.');
  return new Uint8Array(Buffer.from(result.key.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
};
