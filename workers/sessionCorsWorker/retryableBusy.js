import { coordinatorBusyBody, SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';

// Every busy answer from the session coordinator comes before the request had
// any effect (shared/sessionCoordinatorBusy.mjs), wherever in the Worker it
// was refused, so it is marked safe to send again here, once, on its way out.
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
