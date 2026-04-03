import { toTrimmedString } from './stringCoercion.js';

export const normalizeAuthenticatedActionPayload = ({ payload } = {}) => ({
  ok: true,
  status: 200,
  error: '',
  payload,
  action: toTrimmedString(payload?.action).toLowerCase(),
});

export const readAuthenticatedActionPayload = async ({ request } = {}) => {
  const contentType = request?.headers?.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {
      ok: false,
      status: 400,
      error: 'Expected application/json.',
      payload: null,
      action: '',
    };
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'Invalid JSON.',
      payload: null,
      action: '',
    };
  }

  return normalizeAuthenticatedActionPayload({ payload });
};
