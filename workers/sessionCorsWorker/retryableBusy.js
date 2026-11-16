import { coordinatorBusyBody, SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';

// Every busy answer from the session coordinator is marked `retryable: true`
// here, once, on its way out, wherever in the Worker it was refused. It may
// follow work that was done before a reply was lost, so a client sends again
// only a request whose repeat does no harm (shared/sessionCoordinatorBusy.mjs).
// An answer that already says whether it may be repeated is left as it is.
export const markRetryableBusy = async (response) => {
  if (response?.status !== 503 || !/application\/json/i.test(response.headers.get('Content-Type') || '')) return response;
  const body = await response.clone().json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body) || 'retryable' in body || body.error !== SESSION_COORDINATOR_UNAVAILABLE) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  return new Response(JSON.stringify(coordinatorBusyBody(body)), { status: 503, statusText: response.statusText, headers });
};
