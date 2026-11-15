// Who has turned off the Session Agent's use of their answers and files: one key
// per person in the session's coordinator, read on every question, so a change
// applies from the next one. Everyone else is in, as the switch starts.
// Beside it, who has asked for their address to be left off exported items:
// their answers and files are still exported, with no address on them.
const PREFIX = 'session-agent-opt-out-v1:';
const UNATTRIBUTED_PREFIX = 'session-agent-unattributed-v1:';
const PAGE = 1000;
const ADDRESS = /^0x[0-9a-f]{40}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const addressOf = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

/** Only someone signed in with an address has the switch. */
export const canOptOut = (value) => ADDRESS.test(addressOf(value));

/** The stored key for one person's opt-out; a backup restores it as is. */
export const sessionAgentOptOutKey = (address) => PREFIX + addressOf(address);

/** The stored key for one person's choice to leave their address off exports. */
export const sessionAgentUnattributedKey = (address) => UNATTRIBUTED_PREFIX + addressOf(address);

const listAddresses = async (storage, prefix) => {
  const addresses = [];
  for (let startAfter = ''; ;) {
    const keys = [...(await storage.list({ prefix, startAfter, limit: PAGE })).keys()];
    addresses.push(...keys.map((key) => key.slice(prefix.length)));
    if (keys.length < PAGE) return addresses;
    startAfter = keys.at(-1);
  }
};

export const listSessionAgentOptOuts = (storage) => listAddresses(storage, PREFIX);
export const listSessionAgentUnattributed = (storage) => listAddresses(storage, UNATTRIBUTED_PREFIX);

export const dispatchSessionAgentOptOutStore = async (coordinator, operation, payload = {}) => {
  const storage = coordinator.state.storage;
  if (operation === 'list') {
    return json({ ok: true, addresses: await listSessionAgentOptOuts(storage), unattributed: await listSessionAgentUnattributed(storage) });
  }
  const address = addressOf(payload.address);
  if (!canOptOut(address)) return json({ ok: false, error: 'Sign in with an address to change this.' }, 400);
  if (operation === 'read') {
    return json({
      ok: true,
      optedOut: (await storage.get(PREFIX + address)) === true,
      unattributed: (await storage.get(UNATTRIBUTED_PREFIX + address)) === true,
    });
  }
  if (operation === 'set-unattributed') {
    if (typeof payload.unattributed !== 'boolean') {
      return json({ ok: false, error: 'Say whether exports may show your address.' }, 400);
    }
    if (payload.unattributed) await storage.put(UNATTRIBUTED_PREFIX + address, true);
    else await storage.delete(UNATTRIBUTED_PREFIX + address);
    return json({ ok: true, unattributed: payload.unattributed });
  }
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
