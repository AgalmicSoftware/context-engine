import { getAuthHeaders, resetAuthState } from '/js/state.mjs';

export async function apiLocal(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
  const response = await fetch(path, {
    ...opts,
    headers: {
      ...headers,
      ...(opts.headers || {}),
    },
  });
  if (response.status === 401) {
    resetAuthState();
    let body;
    try {
      body = await response.json();
    } catch {
      return { error: 'Unauthorized', _httpStatus: 401 };
    }
    return {
      ...(body && typeof body === 'object' ? body : {}),
      _httpStatus: 401,
    };
  }
  return response.json();
}

export async function persistSessionSelection(selectedSlugs) {
  try {
    await apiLocal('/api/config', {
      method: 'POST',
      body: JSON.stringify({
        selectedSessions: selectedSlugs,
        defaultSession: selectedSlugs[0] || '',
      }),
    });
  } catch (err) {
    console.warn('Failed to persist session selection:', err);
  }
}
