export const resolveTopLevelRouteSelection = ({
  path,
  method,
  request,
  deps,
} = {}) => {
  const authorizationHeader = request?.headers?.get?.('authorization') || '';
  const hasAuthorizationHeader = !!authorizationHeader;
  const hasTrimmedAuthorization = !!deps?.toStr?.(authorizationHeader).trim();

  if (method === 'OPTIONS') {
    return { kind: 'options' };
  }

  if (path === '/auth/nonce' && method === 'POST') {
    return { kind: 'auth-nonce' };
  }

  if (path === '/auth/login' && method === 'POST') {
    return { kind: 'auth-login' };
  }

  if (path === '/arweave/upload' && method === 'POST') {
    return {
      kind: 'arweave-upload',
      hasAuthorizationHeader,
    };
  }

  if (path === '/lit/payment-delegation' && method === 'POST' && !hasTrimmedAuthorization) {
    return {
      kind: 'lit-payment-delegation-bootstrap',
    };
  }

  if (path === '/sponsored/redeem-deploy' && method === 'POST') {
    return {
      kind: 'sponsored-bootstrap-redeem',
      action: 'deploy',
    };
  }

  if (path === '/sponsored/redeem-faucet' && method === 'POST') {
    return {
      kind: 'sponsored-bootstrap-redeem',
      action: 'faucet',
    };
  }

  if (path.startsWith('/admin/') && method === 'POST') {
    return {
      kind: 'admin',
      action: path.replace('/admin/', '').trim(),
    };
  }

  if (!hasTrimmedAuthorization && method === 'POST' && (path === '/ai' || path === '/transcribe')) {
    return {
      kind: 'anonymous',
      anonymousRoute: path === '/transcribe' ? 'transcribe' : 'ai',
    };
  }

  return { kind: 'authenticated' };
};
