/** @file sessionNames.ts: the names people give themselves in a session, read from where the session keeps them. */
import { getShortenedAddress } from '../ui/displayHelpers';
import { readWorkerCapabilities } from '../worker/workerCapabilities';
import { fetchWorkerWithAuth, getCachedWorkerSessionToken } from '../worker/workerAuth';
import { groupReadHeaders } from '../worker/workerGroupReadProof';
import { defaultStrictAllowDemoFallback } from '../worker/workerSessionResolution.js';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability';

export const SESSION_NAMES_FEATURE = 'session_names_v1';

/** Lowercased address to the name its owner set in this session. */
export type SessionNames = Readonly<Record<string, string>>;

/** Where a session keeps names: its Session Worker today; an on-chain registry can implement the same. */
export type SessionNamesSource = {
  /** False once the session's admins turn names off: no one sees or sets one, and answers' names stay hidden. */
  enabled: boolean;
  /** Every name this reader may see; empty, not an error, for someone the session doesn't let read them. */
  readAll: () => Promise<SessionNames>;
  /** Sets the signed-in person's own name; '' removes it. Resolves to the name as stored, or null. */
  setOwn: (name: string) => Promise<string | null>;
};

export type SessionNamesOptions = { sessionSlug: string; sessionConfig: unknown; account: string };

/** A name as the Worker stores and compares it, so an unchanged name isn't sent again. */
export const normalizeSessionName = (name: unknown): string =>
  String(name ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ');

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readNames = (body: unknown): SessionNames => {
  const names: Record<string, string> = {};
  for (const [address, name] of Object.entries(asRecord(asRecord(body).names))) {
    if (typeof name === 'string' && name.trim()) names[address.toLowerCase()] = name;
  }
  return names;
};

// One read serves every view on the page for a short while; a save here clears it.
const READ_TTL_MS = 30_000;
const reads = new Map<string, { at: number; names: Promise<SessionNames> }>();

const changeListeners = new Set<() => void>();
/** Hears every name saved from this page, so each view showing names can reload them. */
export const subscribeSessionNames = (listener: () => void): (() => void) => {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
};

const NAMES_OFF: SessionNamesSource = {
  enabled: false,
  readAll: async () => ({}),
  setOwn: async () => {
    throw new Error('Names are off in this session.');
  },
};

const workerSource = (base: string, options: SessionNamesOptions): SessionNamesSource => {
  const session = {
    sessionSlug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
    context: { account: options.account },
    workerUrl: base,
    allowDemoFallback: defaultStrictAllowDemoFallback(),
  };
  const slugQuery = `slug=${encodeURIComponent(options.sessionSlug)}`;
  return {
    enabled: true,
    // Reading never asks for a sign-in: a held token widens what the Worker shows, and without one it answers
    // as it would anyone signed out.
    readAll: async () => {
      const token = options.account ? await getCachedWorkerSessionToken(session) : '';
      const key = `${base}|${options.sessionSlug}|${token}`;
      const kept = reads.get(key);
      if (kept && Date.now() - kept.at < READ_TTL_MS) return kept.names;
      const names = fetch(`${base}/names?${slugQuery}`, {
        method: 'GET',
        headers: {
          ...groupReadHeaders(base, options.sessionSlug),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        // The Worker lets a browser keep the answer for 30s; a save here must show at once.
        cache: 'no-cache',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
        .then(async (response) => {
          if (response.ok) return readNames(await response.json().catch(() => ({})));
          // A refusal, such as an expired sign-in, is asked again next time rather than kept.
          forget();
          return {};
        })
        .catch(() => {
          forget();
          return {};
        });
      // Only this read is dropped, never a newer one kept under the same key.
      const forget = () => {
        if (reads.get(key)?.names === names) reads.delete(key);
      };
      reads.set(key, { at: Date.now(), names });
      return names;
    },
    setOwn: async (name) => {
      const response = await fetchWorkerWithAuth(
        `${base}/names/set`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) },
        session,
      );
      const result = asRecord(await response.json().catch(() => ({})));
      // The Worker's refusals are sentences a person can read ("Names can't claim a role").
      if (!response.ok) {
        throw new Error(String(result.error || '') || `The name couldn't be saved (${response.status}). Try again.`);
      }
      reads.clear();
      changeListeners.forEach((listener) => listener());
      return typeof result.name === 'string' && result.name ? result.name : null;
    },
  };
};

// One source per session, reader and setting, so views can tell a reload from a change.
const sources = new Map<string, SessionNamesSource>();

/**
 * The session's place for names, or null where it has none: an on-chain session, or a Session Worker from
 * before names. Without one, a person's own name stays on this device. Throws when the Worker can't be asked,
 * since a Worker that keeps names must not be taken for one that doesn't.
 */
export const resolveSessionNamesSource = async (options: SessionNamesOptions): Promise<SessionNamesSource | null> => {
  const base = getUsableSessionWorkerUrl({
    slug: options.sessionSlug,
    sessionConfig: options.sessionConfig,
    requireExactWorkerSession: true,
  }).replace(/\/+$/, '');
  if (!base) return null;
  const capabilities = await readWorkerCapabilities(base, options.sessionSlug);
  if (capabilities.unavailable) throw new Error("The session's Worker didn't say whether it keeps names.");
  if (!capabilities.features.includes(SESSION_NAMES_FEATURE)) return null;
  if (asRecord(options.sessionConfig).namesEnabled === false) return NAMES_OFF;
  const key = `${base}|${options.sessionSlug}|${options.account.toLowerCase()}`;
  const kept = sources.get(key) || workerSource(base, options);
  sources.set(key, kept);
  return kept;
};

/** An address as the site shortens it, with a real ellipsis. */
export const shortSessionAddress = (address: string): string =>
  String(getShortenedAddress(address, false)).replace('...', '…');

/**
 * What to show for each named address: the name, then the short address in brackets. Names aren't unique and
 * anyone can pick any name, so the address always stays in sight.
 */
export const sessionNameLabels = (names: SessionNames): Record<string, string> => {
  const labels: Record<string, string> = {};
  for (const [address, name] of Object.entries(names)) labels[address] = `${name} (${shortSessionAddress(address)})`;
  return labels;
};

export type SessionNameMatch = { address: string; name: string; label: string };

/**
 * The named accounts whose name contains what was typed, ignoring case and spacing; names that start with it
 * come first. Two accounts with one name are two matches, told apart by their short address.
 */
export const findSessionNameMatches = (names: SessionNames, typed: string, limit = 6): SessionNameMatch[] => {
  const query = normalizeSessionName(typed).toLocaleLowerCase();
  if (!query) return [];
  const labels = sessionNameLabels(names);
  return Object.entries(names)
    .map(([address, name]) => ({ address, name, label: labels[address], at: name.toLocaleLowerCase().indexOf(query) }))
    .filter((match) => match.at >= 0)
    .sort(
      (a, b) =>
        Math.min(a.at, 1) - Math.min(b.at, 1) ||
        a.name.toLocaleLowerCase().localeCompare(b.name.toLocaleLowerCase()) ||
        (a.address < b.address ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ address, name, label }) => ({ address, name, label }));
};
