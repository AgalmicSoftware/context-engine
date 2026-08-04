/**
 * @file compareUsers.js
 * @module compareUsers
 * @description User comparison algorithms — pure math and deterministic computation helpers
 *              for PCA, clustering, similarity scoring, opinion Venn diagrams, and stance encoding.
 *
 * Key exports: buildUsersFromCaches, pcaLiteCompass, opinionVennTriplet, computeOverlapMatrix, deriveUserLabels
 */

// Purpose: centralize compare/computation helpers (pure math + deterministic logic).
// No LLM, no network, no React. Pure functions only.

/* =========================
 * Tiny helpers
 * ========================= */

import { createLogger } from '../logging.js';
import {
  buildOnchainSbtMembershipIdentity,
  projectOnchainSbtMembership,
  selectCanonicalMembershipProjection,
  type CanonicalMembershipIdentity,
  type CanonicalMembershipProjection,
} from '../../domains/membership/membershipProjection';
import { getSbtDisplayName, getSbtMaskedFieldValue } from '../sbt/sbtDisplayNames.js';
import { RATING_MAX, RATING_MIN } from './ratingValue.js';
import { hashSeed, mulberry32 } from './seededPrng.js';

type UnknownRecord = Record<string, unknown>;
type RegionKey = 'a' | 'b' | 'c' | 'ab' | 'ac' | 'bc' | 'abc';
type RegionCounts = Record<RegionKey, number>;
type RegionEvidenceMap = Record<RegionKey, string[]>;
type RegionSetMap = Record<RegionKey, Set<string>>;

interface CompareSbtEntry extends UnknownRecord {
  name?: string;
  sbtName?: string;
  label?: string;
  token?: string;
  address?: string;
  compareKey?: string;
  sbtAddress?: string;
  sbtInfo?: UnknownRecord;
}

interface CompareQuestion extends UnknownRecord {
  id?: string;
  questionID?: string;
  questionId?: string;
  type?: string;
  prompt?: string;
  answer?: unknown;
  importance?: unknown;
  tags?: unknown;
  additionalComment?: string;
}

interface CompareSurvey extends UnknownRecord {
  id?: string;
  title?: string;
}

export interface CompareUser extends UnknownRecord {
  address?: string;
  addressLower?: string;
  label?: string;
  sbts?: CompareSbtEntry[];
  questions?: CompareQuestion[];
  surveys?: unknown[];
  tokens?: Map<string, StanceToken>;
}

interface BuiltCompareSbtEntry extends CompareSbtEntry {
  name: string;
  address: string;
  compareKey: string;
  kind: 'sbt_onchain';
  membershipKey: string;
  chainId: string;
  sessionSlug: string;
}

export interface BuiltCompareUser extends CompareUser {
  address: string;
  sbts: BuiltCompareSbtEntry[];
  questions: CompareQuestion[];
  surveys: CompareSurvey[];
}

export type BuildUsersFromCachesOptions = {
  sessionSlug?: unknown;
};

interface StanceToken {
  sign: number;
  weight: number;
}

interface EncodedStances {
  tokens: Map<string, StanceToken>;
}

interface CompassAxis {
  id: 'x' | 'y';
  label: string;
  description: string;
}

interface CompassPoint {
  address: string;
  x: number;
  y: number;
}

interface CompassBundle {
  axes: CompassAxis[];
  points: CompassPoint[];
  evidence: {
    x: string[];
    y: string[];
  };
}

interface OverlapColumn {
  key: string;
  label: string;
}

type OpinionOverlapRows = Array<Array<-1 | 0 | 1>>;
type SbtOverlapRows = Array<Array<{ has: boolean }>>;

interface SbtAggregate {
  identity: CanonicalMembershipIdentity;
  sbtAddress: string;
  sbtInfo: UnknownRecord | null;
  ownershipByAddress: Record<string, CanonicalMembershipProjection | undefined>;
}

interface BookmarkEntry {
  [key: string]: unknown;
  address: string;
  addressLower: string;
  label: string;
}

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const asRecordOrNull = (value: unknown): UnknownRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null;

const cacheLog = createLogger('cache');

const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
const toLower = (s: unknown): string =>
  String(s || '')
    .toLowerCase()
    .trim();
const MASKED_SBT_LABEL = getSbtMaskedFieldValue();

export function getCompareSbtLabel(entry: Partial<CompareSbtEntry> | null = null): string {
  const info = entry?.sbtInfo;
  const displayName = info && typeof info === 'object' ? getSbtDisplayName(info) : '';
  return String(displayName || entry?.name || entry?.sbtName || entry?.label || entry?.token || '').trim();
}

export function getCompareSbtKey(entry: Partial<CompareSbtEntry> | null = null): string {
  const explicitKey = toLower(entry?.compareKey);
  if (explicitKey) return explicitKey;
  const label = getCompareSbtLabel(entry);
  const address = toLower(entry?.address || entry?.sbtAddress || entry?.sbtInfo?.sbtAddress || '');
  if (label === MASKED_SBT_LABEL && address) return address;
  return toLower(label) || address;
}

export function shortenPlain(addr: unknown): string {
  const a = String(addr || '');
  return /^0x[0-9a-fA-F]{40}$/.test(a) && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function isValidAddress(address: unknown): boolean {
  const s = String(address || '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(s) || s.endsWith('.eth');
}

/* =========================
 * Opinion encoding (merged from opinionEncoding.js)
 * ========================= */
function importanceMultiplier(imp: unknown): number {
  const n = typeof imp === 'number' ? imp : imp != null ? Number(imp) : NaN;
  return clamp(isFinite(n) ? 1 + n / 10 : 1, 1, 2);
}
function normalizeBinarySign(val: unknown): number {
  const v = typeof val === 'string' ? toLower(val) : val;
  if (v === true || v === 'true' || v === 'agree' || v === 'yes' || v === 'y') return 1;
  if (v === false || v === 'false' || v === 'disagree' || v === 'no' || v === 'n') return -1;
  if (v === 'unsure' || v === 'unknown' || v === 'neutral' || v === 'null' || v === '0') return 0;
  return 0;
}
// Exported for cross-implementation parity fixtures.
export function normalizeRatingSignedValue(valRaw: unknown): number {
  const v = typeof valRaw === 'number' ? valRaw : Number(valRaw);
  const span = RATING_MAX - RATING_MIN;
  if (!Number.isFinite(v) || v < RATING_MIN || v > RATING_MAX || span <= 0) return 0;
  const mid = (RATING_MIN + RATING_MAX) / 2;
  return clamp((2 * (v - mid)) / span, -1, 1);
}
function makeToken(qid: unknown, option: unknown = undefined): string {
  const q = toLower(qid);
  return option != null ? `${q}::${toLower(option)}` : q;
}

const STANCE_REGION_SEPARATOR = '::__';

function emptyRegionCounts(): RegionCounts {
  return { a: 0, b: 0, c: 0, ab: 0, ac: 0, bc: 0, abc: 0 };
}

function emptyRegionEvidenceMap(): RegionEvidenceMap {
  return { a: [], b: [], c: [], ab: [], ac: [], bc: [], abc: [] };
}

function emptyRegionSets(): RegionSetMap {
  return {
    a: new Set<string>(),
    b: new Set<string>(),
    c: new Set<string>(),
    ab: new Set<string>(),
    ac: new Set<string>(),
    bc: new Set<string>(),
    abc: new Set<string>(),
  };
}

function encodeOrReuseStances(user: CompareUser): EncodedStances {
  return user && user.tokens instanceof Map ? { tokens: user.tokens } : encodeStancesForUser(user);
}

function stanceRegionKey(token: string, sign: number): string {
  return `${token}${STANCE_REGION_SEPARATOR}${sign}`;
}

function stanceSetForEncoded(enc: EncodedStances): Set<string> {
  const stanceSet = new Set<string>();
  enc.tokens.forEach(({ sign }, token) => {
    if (sign !== 0) stanceSet.add(stanceRegionKey(token, sign));
  });
  return stanceSet;
}

function intersectSets(left: Set<string>, right: Set<string>): Set<string> {
  const out = new Set<string>();
  left.forEach((value) => {
    if (right.has(value)) out.add(value);
  });
  return out;
}

function diffSets(left: Set<string>, right: Set<string>): Set<string> {
  const out = new Set<string>();
  left.forEach((value) => {
    if (!right.has(value)) out.add(value);
  });
  return out;
}

function unionSets(left: Set<string>, right: Set<string>): Set<string> {
  const out = new Set<string>(left);
  right.forEach((value) => out.add(value));
  return out;
}

function buildStanceRegions(pairSets: Set<string>[]): { counts: RegionCounts; sets: RegionSetMap } {
  const sets = emptyRegionSets();
  if (pairSets.length === 2) {
    const [A, B] = pairSets;
    sets.ab = intersectSets(A, B);
    sets.a = diffSets(A, sets.ab);
    sets.b = diffSets(B, sets.ab);
  } else if (pairSets.length === 3) {
    const [A, B, C] = pairSets;
    sets.abc = intersectSets(intersectSets(A, B), C);
    sets.ab = diffSets(intersectSets(A, B), sets.abc);
    sets.ac = diffSets(intersectSets(A, C), sets.abc);
    sets.bc = diffSets(intersectSets(B, C), sets.abc);
    sets.a = diffSets(A, unionSets(sets.ab, unionSets(sets.ac, sets.abc)));
    sets.b = diffSets(B, unionSets(sets.ab, unionSets(sets.bc, sets.abc)));
    sets.c = diffSets(C, unionSets(sets.ac, unionSets(sets.bc, sets.abc)));
  }

  return {
    counts: {
      a: sets.a.size,
      b: sets.b.size,
      c: sets.c.size,
      ab: sets.ab.size,
      ac: sets.ac.size,
      bc: sets.bc.size,
      abc: sets.abc.size,
    },
    sets,
  };
}

/** encodeStancesForUser(user) → { tokens: Map<token,{sign,weight}> } */
export function encodeStancesForUser(user: Partial<CompareUser> = {}): EncodedStances {
  const tokens = new Map<string, StanceToken>();
  const questions = Array.isArray(user?.questions) ? user.questions : [];
  for (const q of questions) {
    const qid = q?.id || q?.questionID || q?.questionId;
    if (!qid) continue;
    const type = toLower(q?.type || '');
    const ans = q?.answer;
    if (ans == null || ans === '*' || (typeof ans === 'string' && ans.trim() === '')) continue;
    const impMul = importanceMultiplier(q?.importance);
    if (type === 'binary') {
      const sign = normalizeBinarySign(ans);
      if (sign !== 0) tokens.set(makeToken(qid), { sign, weight: 1 * impMul });
    } else if (type === 'rating') {
      const v = normalizeRatingSignedValue(ans);
      if (v !== 0) tokens.set(makeToken(qid), { sign: v > 0 ? 1 : -1, weight: Math.abs(v) * impMul });
    } else if (type === 'multichoice') {
      const arr = Array.isArray(ans) ? ans : typeof ans === 'string' ? [ans] : [];
      for (const opt of arr) {
        const s = String(opt || '').trim();
        if (s) tokens.set(makeToken(qid, s), { sign: 1, weight: 1 * impMul });
      }
    }
  }
  return { tokens };
}

/** selectTopOpinionTokens(users, topN=20) → token[]  (variance × coverage) */
export function selectTopOpinionTokens(users: CompareUser[] = [], topN = 20): string[] {
  const U = Math.max(0, Math.min(Array.isArray(users) ? users.length : 0, 10));
  if (U === 0) return [];
  const encs = (users || []).map(encodeStancesForUser);
  if (encs.every((e) => (e?.tokens?.size || 0) < 3)) return [];
  const allTokens = new Set<string>();
  encs.forEach((e) => e.tokens.forEach((_, t) => allTokens.add(t)));
  const scores: Array<{ tok: string; score: number; cov: number }> = [];
  for (const tok of allTokens) {
    const vals = [];
    let nz = 0;
    for (let i = 0; i < U; i++) {
      const obj = encs[i]?.tokens?.get(tok);
      const v = obj ? obj.sign * obj.weight : 0;
      if (v !== 0) nz++;
      vals.push(v);
    }
    const cov = nz / U;
    if (cov === 0) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / U;
    const varSum = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0);
    const variance = varSum / U;
    scores.push({ tok, score: variance * cov, cov });
  }
  const N = Math.min(Math.max(1, topN || 20), 20);
  return scores
    .sort((a, b) => b.score - a.score || b.cov - a.cov || (a.tok < b.tok ? -1 : 1))
    .slice(0, N)
    .map((x) => x.tok);
}

/** opinionVennTriplet(users3) → counts per 7 regions (sign-aware) */
export function opinionVennTriplet(users3: CompareUser[] = []): RegionCounts {
  const arr = Array.isArray(users3) ? users3.slice(0, 3) : [];
  if (arr.length !== 3) return emptyRegionCounts();
  const pairSets = arr.map((user) => stanceSetForEncoded(encodeOrReuseStances(user)));
  return buildStanceRegions(pairSets).counts;
}

/** computeVennEvidence(users) → counts+evidenceMap+semantics; supports 2 or 3 users */
export function computeVennEvidence(users: CompareUser[] = []): {
  counts: RegionCounts;
  evidenceMap: RegionEvidenceMap;
  semantics: string;
} {
  const arr = Array.isArray(users) ? users.slice(0, 3) : [];
  const semantics = 'Counts = opinion-stance overlaps: identical non-zero signs on the same question/token.';
  if (arr.length < 2 || arr.length > 3) {
    return {
      counts: emptyRegionCounts(),
      evidenceMap: emptyRegionEvidenceMap(),
      semantics,
    };
  }
  const pairSets = arr.map((user) => stanceSetForEncoded(encodeOrReuseStances(user)));
  const regions = buildStanceRegions(pairSets);

  // qid -> prompt lookup for compact labels
  const qMeta = new Map<string, { prompt: string }>();
  (arr || []).forEach((u) =>
    (u?.questions || []).forEach((q) => {
      const id = String(q?.id || q?.questionID || q?.questionId || '').toLowerCase();
      if (id && !qMeta.has(id)) qMeta.set(id, { prompt: String(q?.prompt || '').trim() });
    }),
  );
  const pretty = (pairStr: string): string => {
    const last = pairStr.lastIndexOf(STANCE_REGION_SEPARATOR);
    const token = last >= 0 ? pairStr.slice(0, last) : pairStr;
    const signStr = last >= 0 ? pairStr.slice(last + STANCE_REGION_SEPARATOR.length) : '1';
    const sign = signStr === '-1' ? '−' : '+';
    const idx = token.indexOf('::');
    const qid = idx === -1 ? token : token.slice(0, idx);
    const opt = idx === -1 ? '' : token.slice(idx + 2);
    const promptShort = (qMeta.get(qid)?.prompt || '').slice(0, 28);
    return opt
      ? `${qid}::${opt} (${sign})${promptShort ? ' · ' + promptShort : ''}`
      : `${qid} (${sign})${promptShort ? ' · ' + promptShort : ''}`;
  };
  const cap = (S: Set<string>): string[] => Array.from(S).slice(0, 30).map(pretty);

  const evidenceMap: RegionEvidenceMap = {
    a: cap(regions.sets.a),
    b: cap(regions.sets.b),
    c: cap(regions.sets.c),
    ab: cap(regions.sets.ab),
    ac: cap(regions.sets.ac),
    bc: cap(regions.sets.bc),
    abc: cap(regions.sets.abc),
  };

  // Guarantee non-empty evidence for regions with positive counts
  for (const k of Object.keys(regions.counts) as RegionKey[]) {
    if (regions.counts[k] > 0 && (!Array.isArray(evidenceMap[k]) || evidenceMap[k].length === 0)) {
      evidenceMap[k] = [`${k.toUpperCase()} region (${regions.counts[k]})`];
    }
  }
  return { counts: regions.counts, evidenceMap, semantics };
}

/** pcaLiteCompass(users) → deterministic axes+points in [-1,1] */
export function pcaLiteCompass(users: CompareUser[] = []): CompassBundle {
  const safe = Array.isArray(users) ? users : [];
  const addrList = safe.map((u) => String(u?.address || '').toLowerCase());
  const encs = safe.map(encodeStancesForUser);
  const tokenSet = new Set<string>();
  encs.forEach((e) => e.tokens.forEach((_, t) => tokenSet.add(t)));
  const tokens = Array.from(tokenSet);
  const U = safe.length,
    T = tokens.length;
  const axes: CompassAxis[] = [
    { id: 'x', label: 'Axis 1', description: 'First principal direction of encoded opinions.' },
    { id: 'y', label: 'Axis 2', description: 'Second principal direction of encoded opinions.' },
  ];
  if (U <= 1 || T === 0) {
    const points = addrList.map((a, i) => ({ address: a, x: U > 1 ? clamp(-1 + (2 * i) / (U - 1), -1, 1) : 0, y: 0 }));
    return { axes, points, evidence: { x: [], y: [] } };
  }
  const X: number[][] = Array.from({ length: U }, () => Array(T).fill(0));
  for (let i = 0; i < U; i++) {
    const m = encs[i].tokens;
    for (let j = 0; j < T; j++) {
      const cell = m.get(tokens[j]);
      X[i][j] = cell ? cell.sign * cell.weight : 0;
    }
  }
  const means = Array(T).fill(0);
  for (let j = 0; j < T; j++) {
    let s = 0;
    for (let i = 0; i < U; i++) s += X[i][j];
    means[j] = s / U;
    for (let i = 0; i < U; i++) X[i][j] -= means[j];
  }
  let allZero = true;
  outer: for (let i = 0; i < U; i++) {
    for (let j = 0; j < T; j++) {
      if (X[i][j] !== 0) {
        allZero = false;
        break outer;
      }
    }
  }
  if (allZero) {
    const points = addrList.map((a, i) => ({ address: a, x: U > 1 ? clamp(-1 + (2 * i) / (U - 1), -1, 1) : 0, y: 0 }));
    return { axes, points, evidence: { x: [], y: [] } };
  }
  const rand = mulberry32(hashSeed(JSON.stringify({ addresses: addrList, tokens })));
  const Av = (v: number[]): number[] => {
    const y = Array<number>(U).fill(0);
    for (let i = 0; i < U; i++) {
      let s = 0;
      const row = X[i];
      for (let j = 0; j < T; j++) s += row[j] * v[j];
      y[i] = s;
    }
    return y;
  };
  const ATy = (y: number[]): number[] => {
    const z = Array<number>(T).fill(0);
    for (let j = 0; j < T; j++) {
      let s = 0;
      for (let i = 0; i < U; i++) s += X[i][j] * y[i];
      z[j] = s;
    }
    return z;
  };
  const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * b[i], 0);
  const norm = (v: number[]): number => {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    return Math.sqrt(sum);
  };
  const scale = (v: number[], k: number): number[] => v.map((x) => x * k);
  const sub = (a: number[], b: number[]): number[] => a.map((x, i) => x - b[i]);
  const powerIter = (q: number[] | null = null, iters = 10): number[] => {
    let v = Array(T)
      .fill(0)
      .map(() => rand() - 0.5);
    let vn = norm(v) || 1;
    v = scale(v, 1 / vn);
    for (let k = 0; k < iters; k++) {
      let w = ATy(Av(v));
      if (q) {
        const proj = dot(w, q);
        w = sub(w, scale(q, proj));
      }
      const wn = norm(w) || 1;
      v = scale(w, 1 / wn);
    }
    return v;
  };
  const v1 = powerIter(null, 10),
    v2 = powerIter(v1, 10);
  const s1 = Av(v1),
    s2 = Av(v2);
  const S1 = s1.reduce((a, b) => a + b, 0) >= 0 ? s1 : s1.map((v) => -v);
  const S2 = s2.reduce((a, b) => a + b, 0) >= 0 ? s2 : s2.map((v) => -v);
  const rawMaxAbs = (arr: number[]): number => arr.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const maxAbsS1 = rawMaxAbs(S1);
  const maxAbsS2 = rawMaxAbs(S2);
  const adjustedS2 = maxAbsS1 > 0 && maxAbsS2 < 1e-6 * maxAbsS1 ? S2.map(() => 0) : S2;
  const Xmax = Math.max(1e-9, maxAbsS1);
  const Ymax = Math.max(1e-9, rawMaxAbs(adjustedS2));
  const points = addrList.map((a, i) => ({
    address: a,
    x: clamp(S1[i] / Xmax, -1, 1),
    y: clamp(adjustedS2[i] / Ymax, -1, 1),
  }));
  return { axes, points, evidence: { x: [], y: [] } };
}

/** computeOverlapMatrix(users, topN) → { mode, columns:[{key,label}], rows:(number[][]|{has:boolean}[][]) } */
export function computeOverlapMatrix(
  users: CompareUser[] = [],
  topN = 20,
):
  | { mode: 'opinion'; columns: OverlapColumn[]; rows: OpinionOverlapRows }
  | { mode: 'sbt'; columns: OverlapColumn[]; rows: SbtOverlapRows } {
  const U = Math.max(0, Math.min(Array.isArray(users) ? users.length : 0, 10));
  const N = Math.min(Math.max(1, topN || 20), 20);
  if (U === 0) return { mode: 'opinion', columns: [], rows: [] };

  const encs = users.map(encodeStancesForUser);
  const haveSignal = !encs.every((e) => (e?.tokens?.size || 0) < 3);

  // Build qid → prompt/tags for labels
  const qMeta = new Map<string, { prompt: string; tags: unknown[] }>();
  (users || []).forEach((u) =>
    (u?.questions || []).forEach((q) => {
      const id = String(q?.id || q?.questionID || q?.questionId || '').toLowerCase();
      if (id && !qMeta.has(id))
        qMeta.set(id, { prompt: String(q?.prompt || ''), tags: Array.isArray(q?.tags) ? q.tags : [] });
    }),
  );
  const labelForToken = (tok: string): string => {
    const s = String(tok || '');
    const idx = s.indexOf('::');
    const qid = idx === -1 ? s : s.slice(0, idx);
    const opt = idx === -1 ? '' : s.slice(idx + 2);
    const meta = qMeta.get(qid);
    const tag = (meta?.tags || []).find((t) => typeof t === 'string' && t.length <= 16);
    const base = tag ? `#${tag}` : (meta?.prompt || tok).slice(0, 28);
    return opt ? `${base} · ${opt.slice(0, 16)}` : base;
  };

  if (haveSignal) {
    const topTokens = selectTopOpinionTokens(users, N);
    if (topTokens.length > 0) {
      const columns: OverlapColumn[] = topTokens.map((t) => ({ key: t, label: labelForToken(t) }));
      const rows = encs.map((enc) =>
        columns.map((col) => {
          const cell = enc.tokens.get(col.key);
          return cell ? (cell.sign > 0 ? 1 : -1) : 0; // -1, 0, +1
        }),
      );
      return { mode: 'opinion', columns, rows };
    }
  }

  // Fallback: SBT presence matrix
  const labelByKey = new Map<string, string>();
  const userSets = (users || []).map((u) => {
    const set = new Set<string>();
    (u?.sbts || []).forEach((s) => {
      const key = getCompareSbtKey(s);
      if (!key) return;
      set.add(key);
      if (!labelByKey.has(key)) {
        const label = getCompareSbtLabel(s);
        if (label) labelByKey.set(key, label);
      }
    });
    return set;
  });
  const nameCounts = new Map<string, number>();
  userSets.forEach((set) => set.forEach((key) => nameCounts.set(key, (nameCounts.get(key) || 0) + 1)));
  const topNames = Array.from(nameCounts.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, N);
  const columns: OverlapColumn[] = topNames.map(([key]) => ({ key, label: labelByKey.get(key) || key }));
  const rows = userSets.map((set) => columns.map((col) => ({ has: set.has(col.key) })));
  return { mode: 'sbt', columns, rows };
}

/** sanitizeCompass(bundle, addressesInOrder?) – clamp points, ensure axes & order */
export function sanitizeCompass(bundle: unknown, addressesInOrder: unknown[] = []): CompassBundle | null {
  if (!bundle || typeof bundle !== 'object') return null;
  const bundleRecord = asRecord(bundle);
  const axIn = Array.isArray(bundleRecord.axes) ? bundleRecord.axes.map(asRecord) : [];
  const axX = axIn.find((a) => String(a?.id || '').toLowerCase() === 'x') || axIn[0] || {};
  const axY = axIn.find((a) => String(a?.id || '').toLowerCase() === 'y') || axIn[1] || {};
  const axes: CompassAxis[] = [
    {
      id: 'x',
      label: String(axX?.label || 'Axis 1'),
      description: String(axX?.description || 'First principal direction of encoded opinions.'),
    },
    {
      id: 'y',
      label: String(axY?.label || 'Axis 2'),
      description: String(axY?.description || 'Second principal direction of encoded opinions.'),
    },
  ];
  const ptsMap = new Map<string, CompassPoint>();
  (Array.isArray(bundleRecord.points) ? bundleRecord.points : []).forEach((point) => {
    const p = asRecord(point);
    const a = String(p?.address || '').toLowerCase();
    if (!a) return;
    const x = clamp(Number(p?.x ?? 0), -1, 1),
      y = clamp(Number(p?.y ?? 0), -1, 1);
    ptsMap.set(a, { address: a, x, y });
  });
  const list =
    Array.isArray(addressesInOrder) && addressesInOrder.length
      ? addressesInOrder.map((a) => String(a || '').toLowerCase())
      : Array.from(ptsMap.keys());
  const points = list.map((a) => ptsMap.get(a) || { address: a, x: 0, y: 0 });
  const evidence =
    bundleRecord.evidence && typeof bundleRecord.evidence === 'object'
      ? {
          x: Array.isArray(asRecord(bundleRecord.evidence).x)
            ? (asRecord(bundleRecord.evidence).x as unknown[]).slice(0, 5).map(String)
            : [],
          y: Array.isArray(asRecord(bundleRecord.evidence).y)
            ? (asRecord(bundleRecord.evidence).y as unknown[]).slice(0, 5).map(String)
            : [],
        }
      : { x: [], y: [] };
  return { axes, points, evidence };
}

/** Return per-user sets of stable SBT compare keys (fallback use in visuals). */
export function sbtNameSets(users: CompareUser[] = []): Array<Set<string>> {
  return (users || []).map((u) => {
    const set = new Set<string>();
    (u?.sbts || []).forEach((s) => {
      const key = getCompareSbtKey(s);
      if (key) set.add(key);
    });
    return set;
  });
}

/* =========================
 * Deterministic bullets fallback (convenience for AI orchestrator)
 * ========================= */
export function fallbackBullets(users: CompareUser[] = []): { agreements: string[]; disagreements: string[] } {
  try {
    const agreements: string[] = [];
    const disagreements: string[] = [];

    // Agreements via common SBTs
    const labelByKey = new Map<string, string>();
    const sets = (users || []).map((u) => {
      const set = new Set<string>();
      (u?.sbts || []).forEach((s) => {
        const key = getCompareSbtKey(s);
        if (!key) return;
        set.add(key);
        if (!labelByKey.has(key)) {
          const label = getCompareSbtLabel(s);
          if (label) labelByKey.set(key, label);
        }
      });
      return set;
    });
    const common = sets.length ? [...sets[0]].filter((key) => sets.every((S) => S.has(key))) : [];
    if (common.length) {
      agreements.push(
        `Shared group memberships: ${common
          .slice(0, 5)
          .map((key) => labelByKey.get(key) || key)
          .join(', ')}`,
      );
    }

    // Disagreements via answer diffs on same prompt
    const normalizeFallbackAnswer = (answer: unknown): unknown => {
      if (Array.isArray(answer)) {
        return answer.map((entry) => normalizeFallbackAnswer(entry)).sort();
      }
      if (answer && typeof answer === 'object') {
        const answerRecord = asRecord(answer);
        if (Object.prototype.hasOwnProperty.call(answerRecord, 'value')) {
          return normalizeFallbackAnswer(answerRecord.value);
        }
        if (Object.prototype.hasOwnProperty.call(answerRecord, 'answer')) {
          return normalizeFallbackAnswer(answerRecord.answer);
        }
      }
      return answer;
    };
    const pmaps = (users || []).map((u) => {
      const m = new Map<string, unknown>();
      (u?.questions || []).forEach((q) => {
        const key = (q?.prompt || '').trim().toLowerCase();
        if (key) m.set(key, normalizeFallbackAnswer(q?.answer));
      });
      return m;
    });
    const allPrompts = new Set(pmaps.flatMap((m) => Array.from(m.keys())));
    const diffs: string[] = [];
    allPrompts.forEach((p) => {
      const vals = new Set(pmaps.map((m) => (m.has(p) ? JSON.stringify(m.get(p)) : '')));
      if (vals.size > 1) diffs.push(p);
    });
    if (diffs.length) disagreements.push(`Different answers on: ${diffs.slice(0, 5).join(', ')}`);

    return { agreements: agreements.slice(0, 12), disagreements: disagreements.slice(0, 12) };
  } catch {
    return { agreements: [], disagreements: [] };
  }
}

/* =========================
 * Deterministic user shaping from caches (Pure Aggregation)
 * ========================= */

const extractAdditionalComment = (obj: unknown): string | null => {
  const record = asRecordOrNull(obj);
  if (!record) return null;
  const candidates = [record.additionalComment, record.additionalComments, record.comment, record.comments];
  for (const c of candidates) {
    if (c == null) continue;
    const commentRecord = asRecordOrNull(c);
    const val = typeof c === 'string' ? c : (commentRecord?.value ?? commentRecord?.text ?? null);
    const enc = commentRecord?.encrypted === true;
    if (val && val !== '*' && !enc && String(val).trim() !== '*') return String(val);
  }
  return null;
};

const extractImportance = (obj: unknown): unknown => {
  const record = asRecord(obj);
  const meta = asRecord(record.meta);
  const answer = asRecord(record.answer);
  const cand =
    record.conviction ??
    record.importance ??
    meta.conviction ??
    meta.importance ??
    answer.conviction ??
    answer.importance;
  return cand === '*' || asRecordOrNull(cand)?.encrypted === true ? undefined : cand;
};

/** buildUsersFromCaches(addresses, sbtCaches, questionsCaches, surveysCaches, options) – session-scoped aggregation */
export function buildUsersFromCaches(
  addresses: unknown[] = [],
  sbtCaches: UnknownRecord[] = [],
  questionsCaches: UnknownRecord[] = [],
  surveysCaches: UnknownRecord[] = [],
  options: BuildUsersFromCachesOptions = {},
): BuiltCompareUser[] {
  // Normalize & dedupe addresses (keep order of first occurrence)
  const seen = new Set<string>();
  const addrs: string[] = [];
  (addresses || []).forEach((a) => {
    const s = String(a || '').trim();
    if (!s) return;
    if (seen.has(s.toLowerCase())) return;
    seen.add(s.toLowerCase());
    addrs.push(s);
  });

  // ---------- Aggregate SBTs across all groups & networks ----------
  // Membership identity includes the active session, chain, and contract.
  const sbtAgg: Record<string, SbtAggregate> = {};
  try {
    sbtCaches.forEach((cacheObj) => {
      if (!cacheObj || typeof cacheObj !== 'object') return;
      Object.keys(cacheObj).forEach((netKey) => {
        const netObj = asRecord(cacheObj[netKey]);
        const list = asRecord(netObj.sbtList);
        Object.keys(list).forEach((addrLowerKey) => {
          const entry = asRecord(list[addrLowerKey]);
          const contractAddress = String(entry.sbtAddress || addrLowerKey || '').trim();
          if (!contractAddress) return;
          const identity = buildOnchainSbtMembershipIdentity({
            chainId: netKey,
            contractAddress,
            sessionSlug: options.sessionSlug,
          });
          const key = identity.key;
          const a = sbtAgg[key] || {
            identity,
            sbtAddress: contractAddress,
            sbtInfo: null,
            ownershipByAddress: {},
          };

          // Prefer richer sbtInfo (merge shallow)
          const entryInfo = asRecordOrNull(entry.sbtInfo);
          if (entryInfo) a.sbtInfo = a.sbtInfo ? { ...a.sbtInfo, ...entryInfo } : entryInfo;

          addrs.forEach((address) => {
            const addressLower = address.toLowerCase();
            const candidate = projectOnchainSbtMembership({
              chainId: netKey,
              contractAddress,
              entry,
              sessionSlug: options.sessionSlug,
              subjectAddress: addressLower,
            });
            a.ownershipByAddress[addressLower] = selectCanonicalMembershipProjection(
              a.ownershipByAddress[addressLower],
              candidate,
            );
          });

          if (entry.sbtAddress) a.sbtAddress = String(entry.sbtAddress);
          sbtAgg[key] = a;
        });
      });
    });
  } catch (e) {
    cacheLog.error('compareUsers: error aggregating SBT caches:', e);
  }

  // ---------- Aggregate Questions across all groups & networks ----------
  // qIdLower -> questionData
  const combinedQuestions: Record<string, UnknownRecord> = {};
  // qIdLower -> { responderLower -> responseObj_or_string }
  const combinedQuestionResponses: Record<string, Record<string, unknown>> = {};
  try {
    questionsCaches.forEach((cacheObj) => {
      if (!cacheObj || typeof cacheObj !== 'object') return;
      Object.keys(cacheObj).forEach((netKey) => {
        const netObj = asRecord(cacheObj[netKey]);
        const qMap = asRecord(netObj.questions);
        Object.keys(qMap).forEach((qidRaw) => {
          const qid = String(qidRaw || '').toLowerCase();
          if (!combinedQuestions[qid]) combinedQuestions[qid] = asRecord(qMap[qidRaw] || qMap[qid]);
        });

        const qrMap = asRecord(netObj.questionResponses);
        Object.keys(qrMap).forEach((qidRaw) => {
          const qid = String(qidRaw || '').toLowerCase();
          if (!combinedQuestionResponses[qid]) combinedQuestionResponses[qid] = {};
          const perQ = asRecord(qrMap[qidRaw] || qrMap[qid]);
          Object.keys(perQ).forEach((resAddrRaw) => {
            const ra = String(resAddrRaw || '').toLowerCase();
            combinedQuestionResponses[qid][ra] = perQ[resAddrRaw];
          });
        });
      });
    });
  } catch (e) {
    cacheLog.error('compareUsers: error aggregating question caches:', e);
  }

  // ---------- Aggregate Surveys across all groups & networks ----------
  // surveyIdLower -> surveyData
  const combinedSurveys: Record<string, UnknownRecord> = {};
  // surveyIdLower -> { responderLower -> responseObj_or_string }
  const combinedSurveyResponses: Record<string, Record<string, unknown>> = {};
  try {
    surveysCaches.forEach((cacheObj) => {
      if (!cacheObj || typeof cacheObj !== 'object') return;
      Object.keys(cacheObj).forEach((netKey) => {
        const netObj = asRecord(cacheObj[netKey]);

        const sMap = asRecord(netObj.surveys);
        Object.keys(sMap).forEach((sidRaw) => {
          const sid = String(sidRaw || '').toLowerCase();
          if (!combinedSurveys[sid]) combinedSurveys[sid] = asRecord(sMap[sidRaw] || sMap[sid]);
        });

        const srMap = asRecord(netObj.surveyResponses);
        Object.keys(srMap).forEach((sidRaw) => {
          const sid = String(sidRaw || '').toLowerCase();
          if (!combinedSurveyResponses[sid]) combinedSurveyResponses[sid] = {};
          const perS = asRecord(srMap[sidRaw] || srMap[sid]);
          Object.keys(perS).forEach((resAddrRaw) => {
            const ra = String(resAddrRaw || '').toLowerCase();
            combinedSurveyResponses[sid][ra] = perS[resAddrRaw];
          });
        });
      });
    });
  } catch (e) {
    cacheLog.error('compareUsers: error aggregating survey caches:', e);
  }

  // ---------- Helpers ----------
  const isNonBlankAnswer = (val: unknown): boolean =>
    Array.isArray(val) ? val.length > 0 : val !== '*' && val !== '' && val != null;

  // ---------- Build per-user profiles ----------
  const users = addrs.map((address) => {
    const addrLower = String(address || '').toLowerCase();

    // SBTs
    const sbts: BuiltCompareSbtEntry[] = [];
    Object.keys(sbtAgg).forEach((key) => {
      const e = sbtAgg[key];
      const displayName = getSbtDisplayName(e?.sbtInfo || null);
      const listed = !!displayName;
      if (!listed) return;
      const sbtAddress = e.sbtAddress || key;
      const ownership = e.ownershipByAddress[addrLower];
      if (ownership?.status === 'member') {
        sbts.push({
          name: displayName,
          address: sbtAddress,
          compareKey: e.identity.key,
          membershipKey: e.identity.key,
          kind: 'sbt_onchain',
          chainId: e.identity.chainId,
          sessionSlug: e.identity.sessionSlug,
          ...(e?.sbtInfo ? { sbtInfo: e.sbtInfo } : {}),
          ...(typeof e?.sbtInfo?.image === 'string' ? { image: e.sbtInfo.image } : {}),
        });
      }
    });

    // Questions (union of direct questionResponses + surveyResponses-derived answers)
    const questions: CompareQuestion[] = [];
    const qSeen = new Set<string>(); // dedupe by qid

    // From questionResponses
    Object.keys(combinedQuestionResponses).forEach((qid) => {
      const perQ = combinedQuestionResponses[qid] || {};
      const candidate = perQ[addrLower];
      if (!candidate) return;

      let obj: unknown = candidate;
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch {
          obj = null;
        }
      }
      if (!obj) return;
      const objRecord = asRecord(obj);
      const answerRecord = asRecord(objRecord.answer);
      const ans = answerRecord.value;
      if (!isNonBlankAnswer(ans)) return;

      const qData = combinedQuestions[qid] || {};
      qSeen.add(qid);
      questions.push({
        id: qid,
        type: String(qData.type || objRecord.type || 'unknown'),
        prompt: String(qData.prompt || objRecord.prompt || 'Unknown Question'),
        answer: ans,
        importance: extractImportance(obj),
        additionalComment: extractAdditionalComment(obj) || undefined,
      });
    });

    // From surveyResponses (fill gaps only)
    Object.keys(combinedSurveyResponses).forEach((sid) => {
      const perS = combinedSurveyResponses[sid] || {};
      const raw = perS[addrLower];
      if (!raw) return;

      let respObj: unknown = raw;
      if (typeof respObj === 'string') {
        try {
          respObj = JSON.parse(respObj);
        } catch {
          respObj = null;
        }
      }
      const respRecord = asRecord(respObj);
      if (!respObj || !Array.isArray(respRecord.responses)) return;

      respRecord.responses.forEach((rawResponse) => {
        const r = asRecord(rawResponse);
        const answer = asRecord(r.answer);
        const qid = String(r?.questionID || '').toLowerCase();
        if (!qid || qSeen.has(qid)) return;
        const val = answer.value;
        if (!isNonBlankAnswer(val)) return;

        const qData = combinedQuestions[qid] || {};
        qSeen.add(qid);
        questions.push({
          id: qid,
          type: String(qData.type || r.type || 'unknown'),
          prompt: String(qData.prompt || r.prompt || 'Unknown Question'),
          answer: val,
          importance: extractImportance(r),
          additionalComment: extractAdditionalComment(r) || undefined,
        });
      });
    });

    // Surveys (only count those with any non-blank answer)
    const surveys: CompareSurvey[] = [];
    Object.keys(combinedSurveyResponses).forEach((sid) => {
      const perS = combinedSurveyResponses[sid] || {};
      const raw = perS[addrLower];
      if (!raw) return;

      let respObj: unknown = raw;
      if (typeof respObj === 'string') {
        try {
          respObj = JSON.parse(respObj);
        } catch {
          respObj = null;
        }
      }
      const respRecord = asRecord(respObj);
      if (!respObj || !Array.isArray(respRecord.responses)) return;

      const hasNonBlank = respRecord.responses.some((rawResponse) =>
        isNonBlankAnswer(asRecord(asRecord(rawResponse).answer).value),
      );
      if (hasNonBlank) {
        const sData = combinedSurveys[sid] || {};
        surveys.push({
          id: sid,
          title: String(sData.title || 'Untitled Survey'),
        });
      }
    });

    return {
      address,
      sbts,
      questions,
      surveys,
    };
  });

  return users;
}

/** readBookmarksNormalized(rawJson) → [{address,addressLower,label}] */
export function readBookmarksNormalized(rawJson: unknown): BookmarkEntry[] {
  const out: BookmarkEntry[] = [];
  try {
    if (!rawJson) return out;
    const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    const parsedRecord = asRecord(parsed);
    const users = Array.isArray(parsedRecord.users) ? parsedRecord.users : [];
    const seen = new Set<string>();
    for (const u of users) {
      let addrRaw: string | null = null;
      let label: string | null = null;
      if (typeof u === 'string') {
        addrRaw = String(u || '').trim();
      } else if (u && typeof u === 'object') {
        const userRecord = asRecord(u);
        addrRaw = String(userRecord.address || '').trim();
        const nick = typeof userRecord.nickname === 'string' ? userRecord.nickname.trim() : '';
        const uname = typeof userRecord.username === 'string' ? userRecord.username.trim() : '';
        label = nick || uname || null;
      }
      if (!addrRaw) continue;
      const lower = addrRaw.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push({ address: addrRaw, addressLower: lower, label: label || shortenPlain(addrRaw) });
    }
  } catch (e) {
    cacheLog.warn('compareUsers: fallback', e);
  }
  return out;
}

/** deriveUserLabels(users, bookmarks) – nickname/username/shortened */
export function deriveUserLabels(users: CompareUser[] = [], bookmarks: Array<Partial<BookmarkEntry>> = []): string[] {
  const map = new Map((bookmarks || []).map((b) => [String(b.addressLower || '').toLowerCase(), b.label]));
  return (users || []).map(
    (u, i) => map.get(String(u?.address || '').toLowerCase()) || shortenPlain(u?.address || '') || `User ${i + 1}`,
  );
}
