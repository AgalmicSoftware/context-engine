// Who has turned off the Session Agent's use of their answers and files: one key
// per person in the session's coordinator, read on every question, so a change
// applies from the next one. Everyone else is in, as the switch starts.
const PREFIX = 'session-agent-opt-out-v1:';
const PAGE = 1000;
const ADDRESS = /^0x[0-9a-f]{40}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const addressOf = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** Only someone signed in with an address has the switch. */
export const canOptOut = (value) => ADDRESS.test(addressOf(value));

const listAddresses = async (storage) => {
  const addresses = [];
  for (let startAfter = ''; ;) {
    const keys = [...(await storage.list({ prefix: PREFIX, startAfter, limit: PAGE })).keys()];
    addresses.push(...keys.map((key) => key.slice(PREFIX.length)));
    if (keys.length < PAGE) return addresses;
    startAfter = keys.at(-1);
  }
};

export const dispatchSessionAgentOptOutStore = async (coordinator, operation, payload = {}) => {
  const storage = coordinator.state.storage;
  if (operation === 'list') return json({ ok: true, addresses: await listAddresses(storage) });
  const address = addressOf(payload.address);
  if (!canOptOut(address)) return json({ ok: false, error: 'Sign in with an address to change this.' }, 400);
  if (operation === 'read') return json({ ok: true, optedOut: (await storage.get(PREFIX + address)) === true });
  if (operation === 'set') {
    if (typeof payload.optedOut !== 'boolean') {
      return json({ ok: false, error: 'Say whether the Session Agent may use your answers and files.' }, 400);
    }
    if (payload.optedOut) await storage.put(PREFIX + address, true);
    else await storage.delete(PREFIX + address);
    return json({ ok: true, optedOut: payload.optedOut });
  }
  return json({ ok: false, error: 'Not found.' }, 404);
};
