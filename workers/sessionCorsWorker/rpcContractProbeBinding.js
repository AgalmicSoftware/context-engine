export const createRpcContractProbeHelpersWithWorkerDeps = ({
  deps,
} = {}) => {
  const toStr = typeof deps?.toStr === 'function'
    ? deps.toStr
    : (value) => (typeof value === 'string' ? value : value == null ? '' : String(value));
  const fetchImpl = deps?.fetch || globalThis.fetch;
  const URLWithCtor = deps?.URL || URL;
  const getRegistryInterface = deps?.getRegistryInterface;
  const now = typeof deps?.now === 'function' ? deps.now : Date.now;
  const log = typeof deps?.log === 'function' ? deps.log : () => {};
  const isBlockedOutboundUrl = (
    typeof deps?.isBlockedOutboundUrl === 'function'
      ? deps.isBlockedOutboundUrl
      : () => false
  );
  const warn = (
    (typeof deps?.log?.warn === 'function' ? deps.log.warn : null) ||
    (typeof deps?.warn === 'function' ? deps.warn : null) ||
    (typeof deps?.log === 'function' ? deps.log : null) ||
    console.warn
  );

  const buildBlockedRpcUrlError = () => {
    const err = new Error('Blocked RPC URL');
    err.rpcStatus = 403;
    err.rpcBlocked = true;
    return err;
  };

  const maskRpcUrl = (raw) => {
    const url = toStr(raw).trim();
    if (!url) return '';
    try {
      const parsed = new URLWithCtor(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url.split('?')[0];
    }
  };

  const assertRpcUrlAllowed = (target) => {
    if (isBlockedOutboundUrl(target)) {
      throw buildBlockedRpcUrlError();
    }
  };

  const rpcRequest = async ({ rpcUrl, method, params }) => {
    const target = toStr(rpcUrl).trim();
    if (!target) throw new Error('RPC URL missing');
    assertRpcUrlAllowed(target);
    const res = await fetchImpl(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const text = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      const err = new Error(`RPC non-JSON response (${res.status})`);
      err.rpcStatus = res.status;
      err.rpcBody = text.slice(0, 200);
      throw err;
    }
    if (!res.ok || payload?.error) {
      const err = new Error(payload?.error?.message || `RPC error (${res.status})`);
      err.rpcStatus = res.status;
      err.rpcError = payload?.error || null;
      throw err;
    }
    return payload?.result;
  };

  const callContractFunction = async ({ rpcUrl, contractAddress, iface, method, args }) => {
    const data = iface.encodeFunctionData(method, args);
    const result = await rpcRequest({
      rpcUrl,
      method: 'eth_call',
      params: [{ to: contractAddress, data }, 'latest'],
    });
    return iface.decodeFunctionResult(method, result);
  };

  const callRegistryFunction = async ({ rpcUrl, registryAddress, method, args }) => {
    const iface = getRegistryInterface();
    return callContractFunction({
      rpcUrl,
      contractAddress: registryAddress,
      iface,
      method,
      args,
    });
  };

  const probeRpcUrl = async ({ rpcUrl, label }) => {
    const target = toStr(rpcUrl).trim();
    if (!target) return;
    const startedAt = now();
    try {
      assertRpcUrlAllowed(target);
      const res = await fetchImpl(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      });
      const text = await res.text();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      log('[rpc-probe] response', {
        label,
        rpcUrl: maskRpcUrl(target),
        status: res.status,
        ok: res.ok,
        durationMs: now() - startedAt,
        result: parsed?.result || '',
        bodyPreview: parsed ? '' : text.slice(0, 160),
      });
    } catch (err) {
      warn('[rpc-probe] failed', {
        label,
        rpcUrl: maskRpcUrl(target),
        error: toStr(err?.message || err).trim(),
      });
    }
  };

  const probeRpcUrls = async ({ rpcUrls, label }) => {
    const list = Array.isArray(rpcUrls) ? rpcUrls : [];
    for (const rpcUrl of list) {
      // eslint-disable-next-line no-await-in-loop
      await probeRpcUrl({ rpcUrl, label });
    }
  };

  return {
    maskRpcUrl,
    rpcRequest,
    callContractFunction,
    callRegistryFunction,
    probeRpcUrl,
    probeRpcUrls,
  };
};
