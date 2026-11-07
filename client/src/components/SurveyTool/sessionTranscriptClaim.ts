/**
 * @file sessionTranscriptClaim.ts: hands one speaker's part of a group recording to their own phone. The
 * recorder's screen loops it as QR codes, or sends it as a link, so it reaches no server on the way.
 */
import {
  decodeLinkBytes,
  decodeLinkUtf8,
  deflateLinkBytes,
  encodeBase64Url,
  inflateLinkBytes,
  parseLinkJson,
  readLinkParam,
} from '../../../../shared/linkPayload.mjs';

export const CLAIM_FRAGMENT_KEY = 'claim';
// A version 12 code at level M holds 287 bytes. At this size a phone reads it from arm's length, and it stays
// sharp through a shared screen (65 modules; every code the same size, so nothing jumps as they change).
export const CLAIM_QR_VERSION = 12;
const CLAIM_QR_BYTES = 287;
// Slow enough that a shared screen settles between codes, and well under the three changes a second that count
// as flashing. A phone that misses a code gets it on the next loop.
export const CLAIM_CODE_MS = 800;

const TURN = /^(Person \d+): (.*)$/;
// A stray word isn't a part anyone needs to claim.
const MIN_CLAIM_CHARS = 30;
// What someone was answering; enough to read "I agree" against, without carrying everyone's words.
const CONTEXT_CHARS = 240;
// About five hours of one person talking. Longer parts keep their latest words.
const MAX_CLAIM_CHARS = 120_000;
const MAX_PACKED_CHARS = 100_000;
const MAX_UNPACKED_BYTES = 512 * 1024;
const MAX_FRAMES = 5000;

export type TranscriptClaim = {
  sessionSlug: string;
  person: string;
  /** Interview-style lines: "Responder: …" for this person, "Other person: …" for what they answered. */
  transcript: string;
  /** The group the recorder's link joins, so the person joins it too. */
  joinGroup?: string;
};

export type ClaimFrame = { id: string; index: number; total: number; data: string };

/** The speakers worth a code, by number. */
export const claimablePeople = (transcript: string): string[] => {
  const spoken = new Map<string, number>();
  for (const line of transcript.split('\n')) {
    const turn = TURN.exec(line);
    if (turn) spoken.set(turn[1], (spoken.get(turn[1]) || 0) + turn[2].length);
  }
  return [...spoken]
    .filter(([, chars]) => chars >= MIN_CLAIM_CHARS)
    .map(([person]) => person)
    .sort((left, right) => Number(left.slice(7)) - Number(right.slice(7)));
};

/** One person's part, in the transcript form the interview's mapping reads: their lines, and the line before each. */
export const claimTranscriptFor = (transcript: string, person: string): string => {
  const lines = transcript.split('\n');
  const part = lines.flatMap((line, index) => {
    const turn = TURN.exec(line);
    if (turn?.[1] !== person) return [];
    const before = index > 0 ? TURN.exec(lines[index - 1]) : null;
    return [
      ...(before && before[1] !== person ? [`Other person: ${before[2].slice(-CONTEXT_CHARS)}`] : []),
      `Responder: ${turn[2]}`,
    ];
  });
  const text = part.join('\n');
  return text.length > MAX_CLAIM_CHARS ? `[Earlier lines left out.]\n${text.slice(-MAX_CLAIM_CHARS)}` : text;
};

export const packClaim = async ({ sessionSlug, person, transcript, joinGroup }: TranscriptClaim): Promise<string> =>
  encodeBase64Url(
    await deflateLinkBytes(
      new TextEncoder().encode(
        JSON.stringify({ v: 1, s: sessionSlug, p: person, t: transcript, ...(joinGroup ? { g: joinGroup } : {}) }),
      ),
    ),
  );

const UNREADABLE = 'This code couldn’t be read. Ask for it to be shown again.';

export const unpackClaim = async (
  packed: string,
): Promise<{ ok: true; claim: TranscriptClaim } | { ok: false; error: string }> => {
  const decoded = decodeLinkBytes(packed, { maxLength: MAX_PACKED_CHARS });
  if (!decoded.ok) return { ok: false, error: UNREADABLE };
  let bytes: Uint8Array | null;
  try {
    bytes = await inflateLinkBytes(decoded.bytes, MAX_UNPACKED_BYTES);
  } catch {
    return { ok: false, error: UNREADABLE };
  }
  const text = bytes ? decodeLinkUtf8(bytes) : null;
  const parsed = text?.ok ? parseLinkJson(text.text) : null;
  const value = parsed?.ok ? (parsed.value as Record<string, unknown>) : null;
  const { v, s, p, t, g } = value || {};
  return v === 1 && typeof s === 'string' && typeof p === 'string' && typeof t === 'string' && t.trim()
    ? {
        ok: true,
        claim: { sessionSlug: s, person: p, transcript: t, ...(typeof g === 'string' && g ? { joinGroup: g } : {}) },
      }
    : { ok: false, error: UNREADABLE };
};

const frameUrl = (baseUrl: string, { id, index, total, data }: ClaimFrame) =>
  `${baseUrl}#${CLAIM_FRAGMENT_KEY}=${id}.${index.toString(36)}.${total.toString(36)}.${data}`;

/** A share's id, so codes from two people's shares never mix. */
export const createClaimShareId = (): string =>
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(4)), (byte) => (byte % 36).toString(36)).join('');

/** The looping codes, each a link that opens the session, so an ordinary camera starts the scan. */
export const buildClaimCodes = (packed: string, baseUrl: string, id: string): string[] => {
  const room = CLAIM_QR_BYTES - frameUrl(baseUrl, { id, index: MAX_FRAMES, total: MAX_FRAMES, data: '' }).length;
  if (room < 40) throw new Error('This session’s link is too long for a code.');
  const total = Math.ceil(packed.length / room);
  return Array.from({ length: total }, (_, index) =>
    frameUrl(baseUrl, { id, index, total, data: packed.slice(index * room, (index + 1) * room) }),
  );
};

/** The same data as one link, for when a camera can't be used. */
export const buildClaimLink = (packed: string, baseUrl: string, id: string): string =>
  frameUrl(baseUrl, { id, index: 0, total: 1, data: packed });

const FRAME = /^([0-9a-z]{4})\.([0-9a-z]{1,3})\.([0-9a-z]{1,3})\.([\w-]+)$/;

/** A code or link's frame, read from a whole URL or a location hash. Anything else, such as a join code, is null. */
export const readClaimFrame = (value: unknown): ClaimFrame | null => {
  const text = String(value ?? '');
  const hash = text.indexOf('#');
  if (hash < 0) return null;
  const match = FRAME.exec(readLinkParam(text.slice(hash), CLAIM_FRAGMENT_KEY) || '');
  if (!match) return null;
  const index = parseInt(match[2], 36);
  const total = parseInt(match[3], 36);
  return index < total ? { id: match[1], index, total, data: match[4] } : null;
};

/** Where a scanned code's link leads: this page, or another page of this site. Anyone can print a code, so anything else is neither. */
export const claimCodeDestination = (
  code: string,
  here: Pick<Location, 'origin' | 'pathname'>,
): 'here' | 'other' | '' => {
  try {
    const { origin, pathname } = new URL(code);
    if (origin !== here.origin) return '';
    return pathname === here.pathname ? 'here' : 'other';
  } catch {
    return '';
  }
};

export const hasClaimHash = (hash: unknown): boolean => {
  const raw = String(hash ?? '').replace(/^#/, '');
  return !!raw && new URLSearchParams(raw).has(CLAIM_FRAGMENT_KEY);
};

export const clearClaimHash = (locationLike: Pick<Location, 'pathname' | 'search' | 'hash'>): string => {
  const params = new URLSearchParams(locationLike.hash.replace(/^#/, ''));
  params.delete(CLAIM_FRAGMENT_KEY);
  const hash = params.toString();
  return `${locationLike.pathname}${locationLike.search}${hash ? `#${hash}` : ''}`;
};

/** Gathers one share's frames in any order. A frame from another share starts over, as when the recorder moves on. */
export const createClaimCollector = () => {
  let id = '';
  let parts = new Map<number, string>();
  return {
    add(frame: ClaimFrame): { collected: number; total: number; packed: string } {
      if (frame.id !== id) {
        id = frame.id;
        parts = new Map();
      }
      parts.set(frame.index, frame.data);
      return {
        collected: parts.size,
        total: frame.total,
        packed:
          parts.size === frame.total
            ? Array.from({ length: frame.total }, (_, index) => parts.get(index) || '').join('')
            : '',
      };
    },
  };
};
