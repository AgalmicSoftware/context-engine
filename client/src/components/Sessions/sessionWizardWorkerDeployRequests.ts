import type { AnyRecord } from '../shellTypes';

type PostWorkerAdminRequestInput = {
  auth?: unknown;
  requestBody?: unknown;
  workerUrl?: unknown;
  slug?: unknown;
};

const toRecord = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};

export const postSessionWizardLitBootstrap = async ({
  auth,
  requestBody,
  workerUrl,
  slug,
}: PostWorkerAdminRequestInput): Promise<AnyRecord> => {
  const response = await fetch(`${String(workerUrl || '')}/admin/lit-chipotle-bootstrap-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionSlug: String(slug || ''),
      ...toRecord(requestBody),
      ...toRecord(auth),
    }),
  });
  const responseData = toRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(`Failed to auto-bootstrap the Lit session account (${response.status}).`);
  }
  return responseData;
};
