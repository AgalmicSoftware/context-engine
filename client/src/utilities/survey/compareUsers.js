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
import { getSbtDisplayName, getSbtMaskedFieldValue } from '../sbt/sbtDisplayNames.js';

const cacheLog = createLogger('cache');

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const toLower = (s) =>
  String(s || '')
    .toLowerCase()
    .trim();
const MASKED_SBT_LABEL = getSbtMaskedFieldValue();
const normalizeAddressCountMap = (value = null) => {
  const out = {};
  Object.entries(value || {}).forEach(([addrRaw, countRaw]) => {
    const addr = toLower(addrRaw);
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};
const seedAddressCountMap = (countMapIn = null, addresses = []) => {
  const out = normalizeAddressCountMap(countMapIn);
  (Array.isArray(addresses) ? addresses : []).forEach((addrRaw) => {
    const addr = toLower(addrRaw);
    if (!addr || Number(out[addr]) > 0) return;
    out[addr] = 1;
  });
  return out;
};
const mergeAddressCountMaps = (base = {}, delta = {}) => {
  const out = { ...normalizeAddressCountMap(base) };
  Object.entries(normalizeAddressCountMap(delta)).forEach(([addr, count]) => {
    out[addr] = (out[addr] || 0) + count;
  });
  return out;
};

export function getCompareSbtLabel(entry = null) {
  const info = entry?.sbtInfo;
  const displayName = info && typeof info === 'object' ? getSbtDisplayName(info) : '';
  return String(displayName || entry?.name || entry?.sbtName || entry?.label || entry?.token || '').trim();
}

export function getCompareSbtKey(entry = null) {
  const label = getCompareSbtLabel(entry);
  const address = toLower(entry?.compareKey || entry?.address || entry?.sbtAddress || entry?.sbtInfo?.sbtAddress || '');
  if (label === MASKED_SBT_LABEL && address) return address;
  return toLower(label) || address;
}

export function shortenPlain(addr) {
  const a = String(addr || '');
  return /^0x[0-9a-fA-F]{40}$/.test(a) && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function isValidAddress(address) {
  const s = String(address || '').trim();
  return /^0x[0-9a-fA-F]{40}$/.test(s) || s.endsWith('.eth');
}

/* =========================
 * Opinion encoding (merged from opinionEncoding.js)
 * ========================= */
function importanceMultiplier(imp) {
  const n = typeof imp === 'number' ? imp : imp != null ? Number(imp) : NaN;
  return clamp(isFinite(n) ? 1 + n / 10 : 1, 1, 2);
}
function normalizeBinarySign(val) {
  const v = typeof val === 'string' ? toLower(val) : val;
  if (v === true || v === 'true' || v === 'agree' || v === 'yes' || v === 'y') return 1;
  if (v === false || v === 'false' || v === 'disagree' || v === 'no' || v === 'n') return -1;
  if (v === 'unsure' || v === 'unknown' || v === 'neutral' || v === 'null' || v === '0') return 0;
  return 0;
}
function normalizeRatingSignedValue(valRaw) {
  const v = typeof valRaw === 'number' ? valRaw : Number(valRaw);
  if (!isFinite(v)) return 0;
  const scales = [
    { min: 0, max: 1 },
    { min: 1, max: 5 },
    { min: 1, max: 7 },
    { min: 0, max: 10 },
    { min: 1, max: 10 },
  ];
  const s = scales.find(({ min, max }) => v >= min && v <= max);
  if (!s) return 0;
  const mid = (s.min + s.max) / 2;
  const span = s.max - s.min || 1;
  return clamp((2 * (v - mid)) / span, -1, 1);
}
function makeToken(qid, option) {
  const q = toLower(qid);
  return option != null ? `${q}::${toLower(option)}` : q;
}

/** encodeStancesForUser(user) → { tokens: Map<token,{sign,weight}> } */
export function encodeStancesForUser(user) {
  const tokens = new Map();
  const questions = Array.isArray(user?.questions) ? user.questions : [];
  for (const q of questions) {
    const qid = q?.id || q?.questionID || q?.questionId;
    if (!qid) continue;
    const type = toLower(q?.type || '');
    const ans = q?.answer;
    if (ans == null || ans === '' || ans === '*') continue;
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
export function selectTopOpinionTokens(users, topN = 20) {
  const U = Math.max(0, Math.min(Array.isArray(users) ? users.length : 0, 10));
  if (U === 0) return [];
  const encs = (users || []).map(encodeStancesForUser);
  if (encs.every((e) => (e?.tokens?.size || 0) < 3)) return [];
  const allTokens = new Set();
  encs.forEach((e) => e.tokens.forEach((_, t) => allTokens.add(t)));
  const scores = [];
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
export function opinionVennTriplet(users3) {
  const arr = Array.isArray(users3) ? users3.slice(0, 3) : [];
  if (arr.length !== 3) return { a: 0, b: 0, c: 0, ab: 0, ac: 0, bc: 0, abc: 0 };
  const encs = arr.map((u) => (u && u.tokens instanceof Map ? u : encodeStancesForUser(u)));
  const pairSets = encs.map((e) => {
    const S = new Set();
    e.tokens.forEach(({ sign }, tok) => {
      if (sign !== 0) S.add(`${tok}::${sign}`);
    });
    return S;
  });
  const [A, B, C] = pairSets;
  const inter = (S1, S2) => {
    let c = 0;
    S1.forEach((v) => {
      if (S2.has(v)) c++;
    });
    return c;
  };
  const inter3 = (S1, S2, S3) => {
    let c = 0;
    S1.forEach((v) => {
      if (S2.has(v) && S3.has(v)) c++;
    });
    return c;
  };
  const abc = inter3(A, B, C);
  const ab = inter(A, B) - abc,
    ac = inter(A, C) - abc,
    bc = inter(B, C) - abc;
  const a = A.size - (ab + ac + abc);
  const b = B.size - (ab + bc + abc);
  const c = C.size - (ac + bc + abc);
  return { a, b, c, ab, ac, bc, abc };
}

/** computeVennEvidence(users) → counts+evidenceMap+semantics; supports 2 or 3 users */
export function computeVennEvidence(users) {
  const arr = Array.isArray(users) ? users.slice(0, 3) : [];
  const semantics = 'Counts = opinion-stance overlaps: identical non-zero signs on the same question/token.';
  if (arr.length < 2 || arr.length > 3) {
    return {
      counts: { a: 0, b: 0, c: 0, ab: 0, ac: 0, bc: 0, abc: 0 },
      evidenceMap: { a: [], b: [], c: [], ab: [], ac: [], bc: [], abc: [] },
      semantics,
    };
  }
  const encs = arr.map(encodeStancesForUser);
  const pairSet = (enc) => {
    const S = new Set();
    enc.tokens.forEach(({ sign }, tok) => {
      if (sign !== 0) S.add(`${tok}::__${sign}`);
    });
    return S;
  };
  const pairSets = encs.map(pairSet);
  const inter = (S1, S2) => {
    const out = new Set();
    S1.forEach((v) => {
      if (S2.has(v)) out.add(v);
    });
    return out;
  };
  const diff = (S1, S2) => {
    const out = new Set();
    S1.forEach((v) => {
      if (!S2.has(v)) out.add(v);
    });
    return out;
  };
  const union = (S1, S2) => {
    const out = new Set(S1);
    S2.forEach((v) => out.add(v));
    return out;
  };

  // qid -> prompt lookup for compact labels
  const qMeta = new Map();
  (arr || []).forEach((u) =>
    (u?.questions || []).forEach((q) => {
      const id = String(q?.id || q?.questionID || q?.questionId || '').toLowerCase();
      if (id && !qMeta.has(id)) qMeta.set(id, { prompt: String(q?.prompt || '').trim() });
    }),
  );
  const pretty = (pairStr) => {
    const last = pairStr.lastIndexOf('::__');
    const token = last >= 0 ? pairStr.slice(0, last) : pairStr;
    const signStr = last >= 0 ? pairStr.slice(last + 4) : '1';
    const sign = signStr === '-1' ? '−' : '+';
    const idx = token.indexOf('::');
    const qid = idx === -1 ? token : token.slice(0, idx);
    const opt = idx === -1 ? '' : token.slice(idx + 2);
    const promptShort = (qMeta.get(qid)?.prompt || '').slice(0, 28);
    return opt
      ? `${qid}::${opt} (${sign})${promptShort ? ' · ' + promptShort : ''}`
      : `${qid} (${sign})${promptShort ? ' · ' + promptShort : ''}`;
  };
  const cap = (S) => Array.from(S).slice(0, 30).map(pretty);

  if (arr.length === 2) {
    const [A, B] = pairSets;
    const AB = inter(A, B);
    const A1 = diff(A, AB);
    const B1 = diff(B, AB);
    const evidenceMap = { a: cap(A1), b: cap(B1), c: [], ab: cap(AB), ac: [], bc: [], abc: [] };
    const counts = { a: A1.size, b: B1.size, c: 0, ab: AB.size, ac: 0, bc: 0, abc: 0 };
    for (const k of Object.keys(counts)) {
      if (counts[k] > 0 && (!Array.isArray(evidenceMap[k]) || evidenceMap[k].length === 0)) {
        evidenceMap[k] = [`${k.toUpperCase()} region (${counts[k]})`];
      }
    }
    return { counts, evidenceMap, semantics };
  }

  const [A, B, C] = pairSets;
  const ABC = inter(inter(A, B), C);
  const AB = diff(inter(A, B), ABC);
  const AC = diff(inter(A, C), ABC);
  const BC = diff(inter(B, C), ABC);
  const A1 = diff(A, union(AB, union(AC, ABC)));
  const B1 = diff(B, union(AB, union(BC, ABC)));
  const C1 = diff(C, union(AC, union(BC, ABC)));

  const evidenceMap = { a: cap(A1), b: cap(B1), c: cap(C1), ab: cap(AB), ac: cap(AC), bc: cap(BC), abc: cap(ABC) };
  const counts = { a: A1.size, b: B1.size, c: C1.size, ab: AB.size, ac: AC.size, bc: BC.size, abc: ABC.size };

  // Guarantee non-empty evidence for regions with positive counts
  for (const k of Object.keys(counts)) {
    if (counts[k] > 0 && (!Array.isArray(evidenceMap[k]) || evidenceMap[k].length === 0)) {
      evidenceMap[k] = [`${k.toUpperCase()} region (${counts[k]})`];
    }
  }
  return { counts, evidenceMap, semantics };
}

/** pcaLiteCompass(users) → deterministic axes+points in [-1,1] */
export function pcaLiteCompass(users = []) {
  const safe = Array.isArray(users) ? users : [];
  const addrList = safe.map((u) => String(u?.address || '').toLowerCase());
  const encs = safe.map(encodeStancesForUser);
  const tokenSet = new Set();
  encs.forEach((e) => e.tokens.forEach((_, t) => tokenSet.add(t)));
  const tokens = Array.from(tokenSet);
  const U = safe.length,
    T = tokens.length;
  const axes = [
    { id: 'x', label: 'Axis 1', description: 'First principal direction of encoded opinions.' },
    { id: 'y', label: 'Axis 2', description: 'Second principal direction of encoded opinions.' },
  ];
  if (U <= 1 || T === 0) {
    const points = addrList.map((a, i) => ({ address: a, x: U > 1 ? clamp(-1 + (2 * i) / (U - 1), -1, 1) : 0, y: 0 }));
    return { axes, points, evidence: { x: [], y: [] } };
  }
  const X = Array.from({ length: U }, () => Array(T).fill(0));
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
  const hashSeed = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  const mulberry32 = (a) =>
    function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  const rand = mulberry32(hashSeed(JSON.stringify({ addresses: addrList, tokens })));
  const Av = (v) => {
    const y = Array(U).fill(0);
    for (let i = 0; i < U; i++) {
      let s = 0;
      const row = X[i];
      for (let j = 0; j < T; j++) s += row[j] * v[j];
      y[i] = s;
    }
    return y;
  };
  const ATy = (y) => {
    const z = Array(T).fill(0);
    for (let j = 0; j < T; j++) {
      let s = 0;
      for (let i = 0; i < U; i++) s += X[i][j] * y[i];
      z[j] = s;
    }
    return z;
  };
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
    norm = (v) => Math.hypot(...v),
    scale = (v, k) => v.map((x) => x * k),
    sub = (a, b) => a.map((x, i) => x - b[i]);
  const powerIter = (q = null, iters = 10) => {
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
  const maxAbs = (arr) => Math.max(1e-9, ...arr.map((v) => Math.abs(v)));
  const Xmax = maxAbs(S1),
    Ymax = maxAbs(S2);
  const points = addrList.map((a, i) => ({ address: a, x: clamp(S1[i] / Xmax, -1, 1), y: clamp(S2[i] / Ymax, -1, 1) }));
  return { axes, points, evidence: { x: [], y: [] } };
}

/** computeOverlapMatrix(users, topN) → { mode, columns:[{key,label}], rows:(number[][]|{has:boolean}[][]) } */
export function computeOverlapMatrix(users = [], topN = 20) {
  const U = Math.max(0, Math.min(Array.isArray(users) ? users.length : 0, 10));
  const N = Math.min(Math.max(1, topN || 20), 20);
  if (U === 0) return { mode: 'opinion', columns: [], rows: [] };

  const encs = users.map(encodeStancesForUser);
  const haveSignal = !encs.every((e) => (e?.tokens?.size || 0) < 3);

  // Build qid → prompt/tags for labels
  const qMeta = new Map();
  (users || []).forEach((u) =>
    (u?.questions || []).forEach((q) => {
      const id = String(q?.id || q?.questionID || q?.questionId || '').toLowerCase();
      if (id && !qMeta.has(id))
        qMeta.set(id, { prompt: String(q?.prompt || ''), tags: Array.isArray(q?.tags) ? q.tags : [] });
    }),
  );
  const labelForToken = (tok) => {
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
      const columns = topTokens.map((t) => ({ key: t, label: labelForToken(t) }));
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
  const labelByKey = new Map();
  const userSets = (users || []).map((u) => {
    const set = new Set();
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
  const nameCounts = new Map();
  userSets.forEach((set) => set.forEach((key) => nameCounts.set(key, (nameCounts.get(key) || 0) + 1)));
  const topNames = Array.from(nameCounts.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, N);
  const columns = topNames.map(([key]) => ({ key, label: labelByKey.get(key) || key }));
  const rows = userSets.map((set) => columns.map((col) => ({ has: set.has(col.key) })));
  return { mode: 'sbt', columns, rows };
}

/** sanitizeCompass(bundle, addressesInOrder?) – clamp points, ensure axes & order */
export function sanitizeCompass(bundle, addressesInOrder = []) {
  if (!bundle || typeof bundle !== 'object') return null;
  const axIn = Array.isArray(bundle.axes) ? bundle.axes : [];
  const axX = axIn.find((a) => (a?.id || '').toLowerCase() === 'x') || axIn[0] || {};
  const axY = axIn.find((a) => (a?.id || '').toLowerCase() === 'y') || axIn[1] || {};
  const axes = [
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
  const ptsMap = new Map();
  (Array.isArray(bundle.points) ? bundle.points : []).forEach((p) => {
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
    bundle?.evidence && typeof bundle.evidence === 'object'
      ? {
          x: Array.isArray(bundle.evidence.x) ? bundle.evidence.x.slice(0, 5).map(String) : [],
          y: Array.isArray(bundle.evidence.y) ? bundle.evidence.y.slice(0, 5).map(String) : [],
        }
      : { x: [], y: [] };
  return { axes, points, evidence };
}

/** Return per-user sets of stable SBT compare keys (fallback use in visuals). */
export function sbtNameSets(users = []) {
  return (users || []).map((u) => {
    const set = new Set();
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
export function fallbackBullets(users = []) {
  try {
    const agreements = [];
    const disagreements = [];

    // Agreements via common SBTs
    const labelByKey = new Map();
    const sets = (users || []).map((u) => {
      const set = new Set();
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
    const normalizeFallbackAnswer = (answer) => {
      if (Array.isArray(answer)) {
        return answer.map((entry) => normalizeFallbackAnswer(entry)).sort();
      }
      if (answer && typeof answer === 'object') {
        if (Object.prototype.hasOwnProperty.call(answer, 'value')) {
          return normalizeFallbackAnswer(answer.value);
        }
        if (Object.prototype.hasOwnProperty.call(answer, 'answer')) {
          return normalizeFallbackAnswer(answer.answer);
        }
      }
      return answer;
    };
    const pmaps = (users || []).map((u) => {
      const m = new Map();
      (u?.questions || []).forEach((q) => {
        const key = (q?.prompt || '').trim().toLowerCase();
        if (key) m.set(key, normalizeFallbackAnswer(q?.answer));
      });
      return m;
    });
    const allPrompts = new Set(pmaps.flatMap((m) => Array.from(m.keys())));
    const diffs = [];
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

const extractAdditionalComment = (obj) => {
  if (!obj) return null;
  const candidates = [obj.additionalComment, obj.additionalComments, obj.comment, obj.comments];
  for (const c of candidates) {
    if (c == null) continue;
    const val = typeof c === 'string' ? c : (c.value ?? c.text ?? null);
    const enc = typeof c === 'object' && c.encrypted === true;
    if (val && val !== '*' && !enc && String(val).trim() !== '*') return String(val);
  }
  return null;
};

const extractImportance = (obj) => {
  const cand =
    obj?.conviction ??
    obj?.importance ??
    obj?.meta?.conviction ??
    obj?.meta?.importance ??
    obj?.answer?.conviction ??
    obj?.answer?.importance;
  return cand === '*' || (cand && cand.encrypted === true) ? undefined : cand;
};

/** buildUsersFromCaches(addresses, sbtCaches, questionsCaches, surveysCaches) – pure aggregation across all groups */
export function buildUsersFromCaches(addresses = [], sbtCaches = [], questionsCaches = [], surveysCaches = []) {
  // Normalize & dedupe addresses (keep order of first occurrence)
  const seen = new Set();
  const addrs = [];
  (addresses || []).forEach((a) => {
    const s = String(a || '').trim();
    if (!s) return;
    if (seen.has(s.toLowerCase())) return;
    seen.add(s.toLowerCase());
    addrs.push(s);
  });

  // ---------- Aggregate SBTs across all groups & networks ----------
  // sbtLower -> { sbtAddress, sbtInfo, mintedCounts, burnedCounts }
  const sbtAgg = {};
  try {
    sbtCaches.forEach((cacheObj) => {
      if (!cacheObj || typeof cacheObj !== 'object') return;
      Object.keys(cacheObj).forEach((netKey) => {
        const netObj = cacheObj[netKey] || {};
        const list = netObj.sbtList || {};
        Object.keys(list).forEach((addrLowerKey) => {
          const entry = list[addrLowerKey] || {};
          const key = (addrLowerKey || '').toLowerCase();
          const a = sbtAgg[key] || {
            sbtAddress: entry.sbtAddress || key,
            sbtInfo: null,
            mintedCounts: {},
            burnedCounts: {},
          };
          const checkpointBackedPartialCounts =
            entry?.countsLoaded !== true &&
            !!entry?.countsScanCheckpoint &&
            typeof entry.countsScanCheckpoint === 'object';

          // Prefer richer sbtInfo (merge shallow)
          if (entry.sbtInfo) a.sbtInfo = a.sbtInfo ? { ...a.sbtInfo, ...entry.sbtInfo } : entry.sbtInfo;

          if (!checkpointBackedPartialCounts) {
            a.mintedCounts = mergeAddressCountMaps(
              a.mintedCounts,
              seedAddressCountMap(entry.mintedCountByAddress, entry.mintedAddresses),
            );
            a.burnedCounts = mergeAddressCountMaps(
              a.burnedCounts,
              seedAddressCountMap(entry.burnedCountByAddress, entry.burnedAddresses),
            );
          }

          if (entry.sbtAddress) a.sbtAddress = entry.sbtAddress;
          sbtAgg[key] = a;
        });
      });
    });
  } catch (e) {
    cacheLog.error('compareUsers: error aggregating SBT caches:', e);
  }

  // ---------- Aggregate Questions across all groups & networks ----------
  // qIdLower -> questionData
  const combinedQuestions = {};
  // qIdLower -> { responderLower -> responseObj_or_string }
  const combinedQuestionResponses = {};
  try {
    questionsCaches.forEach((cacheObj) => {
      if (!cacheObj || typeof cacheObj !== 'object') return;
      Object.keys(cacheObj).forEach((netKey) => {
        const netObj = cacheObj[netKey] || {};
        const qMap = netObj.questions || {};
        Object.keys(qMap).forEach((qidRaw) => {
          const qid = String(qidRaw || '').toLowerCase();
          if (!combinedQuestions[qid]) combinedQuestions[qid] = qMap[qidRaw] || qMap[qid] || {};
        });

        const qrMap = netObj.questionResponses || {};
        Object.keys(qrMap).forEach((qidRaw) => {
          const qid = String(qidRaw || '').toLowerCase();
          if (!combinedQuestionResponses[qid]) combinedQuestionResponses[qid] = {};
          const perQ = qrMap[qidRaw] || qrMap[qid] || {};
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
  const combinedSurveys = {};
  // surveyIdLower -> { responderLower -> responseObj_or_string }
  const combinedSurveyResponses = {};
  try {
    surveysCaches.forEach((cacheObj) => {
      if (!cacheObj || typeof cacheObj !== 'object') return;
      Object.keys(cacheObj).forEach((netKey) => {
        const netObj = cacheObj[netKey] || {};

        const sMap = netObj.surveys || {};
        Object.keys(sMap).forEach((sidRaw) => {
          const sid = String(sidRaw || '').toLowerCase();
          if (!combinedSurveys[sid]) combinedSurveys[sid] = sMap[sidRaw] || sMap[sid] || {};
        });

        const srMap = netObj.surveyResponses || {};
        Object.keys(srMap).forEach((sidRaw) => {
          const sid = String(sidRaw || '').toLowerCase();
          if (!combinedSurveyResponses[sid]) combinedSurveyResponses[sid] = {};
          const perS = srMap[sidRaw] || srMap[sid] || {};
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
  const isNonBlankAnswer = (val) => (Array.isArray(val) ? val.length > 0 : val !== '*' && val !== '' && val != null);

  // ---------- Build per-user profiles ----------
  const users = addrs.map((address) => {
    const addrLower = String(address || '').toLowerCase();

    // SBTs
    const sbts = [];
    Object.keys(sbtAgg).forEach((key) => {
      const e = sbtAgg[key];
      const displayName = getSbtDisplayName(e?.sbtInfo || null);
      const listed = !!displayName;
      if (!listed) return;
      const sbtAddress = e.sbtAddress || key;
      const mintedCount = Number(e.mintedCounts?.[addrLower] || 0);
      const burnedCount = Number(e.burnedCounts?.[addrLower] || 0);
      if (mintedCount > burnedCount) {
        sbts.push({
          name: displayName,
          address: sbtAddress,
          compareKey: getCompareSbtKey({
            name: displayName,
            address: sbtAddress,
            sbtInfo: e?.sbtInfo || null,
          }),
        });
      }
    });

    // Questions (union of direct questionResponses + surveyResponses-derived answers)
    const questions = [];
    const qSeen = new Set(); // dedupe by qid

    // From questionResponses
    Object.keys(combinedQuestionResponses).forEach((qid) => {
      const perQ = combinedQuestionResponses[qid] || {};
      const candidate = perQ[addrLower];
      if (!candidate) return;

      let obj = candidate;
      if (typeof obj === 'string') {
        try {
          obj = JSON.parse(obj);
        } catch {
          obj = null;
        }
      }
      if (!obj) return;
      const ans = obj?.answer?.value;
      if (!isNonBlankAnswer(ans)) return;

      const qData = combinedQuestions[qid] || {};
      qSeen.add(qid);
      questions.push({
        id: qid,
        type: qData.type || obj.type || 'unknown',
        prompt: qData.prompt || obj.prompt || 'Unknown Question',
        answer: Array.isArray(ans) ? ans : ans,
        importance: extractImportance(obj),
        additionalComment: extractAdditionalComment(obj) || undefined,
      });
    });

    // From surveyResponses (fill gaps only)
    Object.keys(combinedSurveyResponses).forEach((sid) => {
      const perS = combinedSurveyResponses[sid] || {};
      const raw = perS[addrLower];
      if (!raw) return;

      let respObj = raw;
      if (typeof respObj === 'string') {
        try {
          respObj = JSON.parse(respObj);
        } catch {
          respObj = null;
        }
      }
      if (!respObj || !Array.isArray(respObj.responses)) return;

      respObj.responses.forEach((r) => {
        const qid = String(r?.questionID || '').toLowerCase();
        if (!qid || qSeen.has(qid)) return;
        const val = r?.answer?.value;
        if (!isNonBlankAnswer(val)) return;

        const qData = combinedQuestions[qid] || {};
        qSeen.add(qid);
        questions.push({
          id: qid,
          type: qData.type || r.type || 'unknown',
          prompt: qData.prompt || r.prompt || 'Unknown Question',
          answer: Array.isArray(val) ? val : val,
          importance: extractImportance(r),
          additionalComment: extractAdditionalComment(r) || undefined,
        });
      });
    });

    // Surveys (only count those with any non-blank answer)
    const surveys = [];
    Object.keys(combinedSurveyResponses).forEach((sid) => {
      const perS = combinedSurveyResponses[sid] || {};
      const raw = perS[addrLower];
      if (!raw) return;

      let respObj = raw;
      if (typeof respObj === 'string') {
        try {
          respObj = JSON.parse(respObj);
        } catch {
          respObj = null;
        }
      }
      if (!respObj || !Array.isArray(respObj.responses)) return;

      const hasNonBlank = respObj.responses.some((r) => isNonBlankAnswer(r?.answer?.value));
      if (hasNonBlank) {
        const sData = combinedSurveys[sid] || {};
        surveys.push({
          id: sid,
          title: sData.title || 'Untitled Survey',
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
export function readBookmarksNormalized(rawJson) {
  const out = [];
  try {
    if (!rawJson) return out;
    const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    const users = Array.isArray(parsed?.users) ? parsed.users : [];
    const seen = new Set();
    for (const u of users) {
      let addrRaw = null,
        label = null;
      if (typeof u === 'string') {
        addrRaw = String(u || '').trim();
      } else if (u && typeof u === 'object') {
        addrRaw = String(u.address || '').trim();
        const nick = typeof u.nickname === 'string' ? u.nickname.trim() : '';
        const uname = typeof u.username === 'string' ? u.username.trim() : '';
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
export function deriveUserLabels(users = [], bookmarks = []) {
  const map = new Map((bookmarks || []).map((b) => [String(b.addressLower || '').toLowerCase(), b.label]));
  return (users || []).map(
    (u, i) => map.get(String(u?.address || '').toLowerCase()) || shortenPlain(u?.address || '') || `User ${i + 1}`,
  );
}
