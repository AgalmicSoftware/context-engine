export const ROUTE_AUTH = Object.freeze({
  TRUSTED_LOCAL: 'trusted-local',
  LOCAL_JWT: 'local-jwt',
});

const authHelperForMode = (auth) => (
  auth === ROUTE_AUTH.TRUSTED_LOCAL
    ? 'requireTrustedLocalRequest'
    : 'requireLocalJwtAuth'
);

const ROUTE_INVENTORY_ENTRIES = [
  {
    method: 'POST',
    path: '/api/auth/local-jwt',
    auth: ROUTE_AUTH.TRUSTED_LOCAL,
    owner: 'auth',
    responseShape: 'local JWT token or validation error',
  },
  {
    method: 'POST',
    path: '/api/auth/worker-token',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'auth',
    responseShape: 'worker-token install status and optional auto-submit result',
  },
  {
    method: 'GET',
    path: '/api/auth/worker-tokens',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'auth',
    responseShape: 'worker-token readiness summary',
  },
  {
    method: 'GET',
    path: '/api/auth/check',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'auth',
    responseShape: 'local auth payload plus worker-token status',
  },
  {
    method: 'GET',
    path: '/api/me',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'auth',
    responseShape: 'local JWT payload',
  },
  {
    method: 'GET',
    path: '/api/agent/me',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent identity, auth mode, and capability metadata',
  },
  {
    method: 'GET',
    path: '/api/sessions',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'session',
    responseShape: 'configured session list',
  },
  {
    method: 'GET',
    path: '/api/agent/sessions',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'canonical agent session list',
  },
  {
    method: 'GET',
    path: '/api/session/worker-url',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'session',
    responseShape: 'worker URL for selected session',
  },
  {
    method: 'GET',
    path: '/api/faucet/check',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'faucet',
    responseShape: 'faucet balance eligibility',
  },
  {
    method: 'POST',
    path: '/api/faucet',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'faucet',
    responseShape: 'worker faucet transfer result',
  },
  {
    method: 'GET',
    path: '/api/questions',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'question',
    responseShape: 'question list for selected sessions',
  },
  {
    method: 'GET',
    path: '/api/agent/questions',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'canonical agent question payload',
  },
  {
    method: 'GET',
    path: '/api/agent/inbox',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent pending-response and approval-request summaries',
  },
  {
    method: 'GET',
    path: '/api/hook/question',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'question',
    responseShape: 'single hook question payload',
  },
  {
    method: 'GET',
    path: '/api/status',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'status',
    responseShape: 'hook/server readiness summary',
  },
  {
    method: 'POST',
    path: '/api/respond',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'response',
    responseShape: 'local response save and optional submit result',
  },
  {
    method: 'POST',
    path: '/api/agent/responses/draft',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent response draft save result',
  },
  {
    method: 'GET',
    path: '/api/agent/responses/drafts',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent response drafts for the authenticated wallet',
  },
  {
    method: 'POST',
    path: '/api/agent/responses/submit-request',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'approval-required response submit request',
  },
  {
    method: 'POST',
    path: '/api/agent/responses/delegated-execute',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'scoped delegated response execution validation and audit record',
  },
  {
    method: 'GET',
    path: '/api/agent/requests/:id',
    match: 'prefix',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent approval request status',
  },
  {
    method: 'POST',
    path: '/api/agent/connect-requests',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'approval-required scoped grant connect request',
  },
  {
    method: 'GET',
    path: '/api/agent/connect-requests/:id',
    match: 'prefix',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'side-effect-free scoped grant connect request read',
  },
  {
    method: 'POST',
    path: '/api/agent/connect-requests/approve',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'human-approved scoped grant creation from a connect request',
  },
  {
    method: 'POST',
    path: '/api/agent/connect-requests/deny',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'human denial of a scoped grant connect request',
  },
  {
    method: 'GET',
    path: '/api/agent/grants',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent scoped grant list',
  },
  {
    method: 'GET',
    path: '/api/agent/grants/:id',
    match: 'prefix',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent scoped grant read',
  },
  {
    method: 'POST',
    path: '/api/agent/grants/revoke',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'agent',
    responseShape: 'agent scoped grant revocation result',
  },
  {
    method: 'POST',
    path: '/api/responses/submit-onchain',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'response',
    responseShape: 'on-chain submit result',
  },
  {
    method: 'GET',
    path: '/api/submit/status',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'response',
    responseShape: 'submit settings/status',
  },
  {
    method: 'GET',
    path: '/api/responses/pending',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'response',
    responseShape: 'pending local responses',
  },
  {
    method: 'POST',
    path: '/api/responses/mark-submitted',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'response',
    responseShape: 'confirmed local submission marker result',
  },
  {
    method: 'POST',
    path: '/api/questions/create',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'question',
    responseShape: 'question creation transaction result',
  },
  {
    method: 'GET',
    path: '/api/settings',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'settings',
    responseShape: 'submit settings',
  },
  {
    method: 'POST',
    path: '/api/settings',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'settings',
    responseShape: 'updated submit settings',
  },
  {
    method: 'GET',
    path: '/api/config',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'config',
    responseShape: 'public hook config',
  },
  {
    method: 'POST',
    path: '/api/config',
    auth: ROUTE_AUTH.LOCAL_JWT,
    owner: 'config',
    responseShape: 'updated public hook config',
  },
];

export const ROUTE_INVENTORY = Object.freeze(
  ROUTE_INVENTORY_ENTRIES.map((route) => Object.freeze({
    ...route,
    authHelper: route.authHelper || authHelperForMode(route.auth),
  }))
);

export const routeKey = ({ method, path } = {}) => `${String(method || '').toUpperCase()} ${String(path || '')}`;

export const ROUTE_INVENTORY_BY_KEY = Object.freeze(
  Object.fromEntries(ROUTE_INVENTORY.map((route) => [routeKey(route), Object.freeze({ ...route })]))
);
