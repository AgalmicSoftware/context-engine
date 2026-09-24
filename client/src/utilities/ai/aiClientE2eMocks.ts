import { createLogger } from '../logging';

type UnknownRecord = Record<string, unknown>;

const aiLog = createLogger('ai');

const asRecord = (value: unknown): UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const readLocalStorageFlag = (key: unknown): boolean => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(String(key || '')) === '1';
  } catch (_) {
    return false;
  }
};

const readQueryFlag = (key: unknown): boolean => {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    const qp = new URLSearchParams(String(window.location.search || ''));
    return qp.get(String(key || '')) === '1';
  } catch (_) {
    return false;
  }
};

export const isE2eAiMockEnabled = (): boolean => {
  // Never enable in production bundles.
  if (process.env.NODE_ENV === 'production') return false;

  try {
    if (globalThis && (globalThis as typeof globalThis & { CE_E2E_AI_MOCK?: boolean }).CE_E2E_AI_MOCK === true) {
      return true;
    }
  } catch (e) {
    aiLog.warn('AI mock flag lookup failed:', e);
  }

  if (readLocalStorageFlag('ce-e2e-ai-mock')) return true;
  if (readQueryFlag('aiMock')) return true;

  return false;
};

export const buildE2eMockCompareBullets = () => ({
  agreements: ['Both participants welcome assistance while keeping people involved in decisions.'],
  disagreements: ['A emphasizes private participation; B places more emphasis on transparent decisions.'],
});

export const buildE2eMockClusterAnalysis = (clusterData: unknown) => {
  const cluster = asRecord(clusterData);
  const idxRaw = cluster.clusterIndex ?? cluster.cluster ?? cluster.index ?? 0;
  const idx = Number(idxRaw);
  const clusterIndex = Number.isFinite(idx) ? idx : 0;
  const sizeRaw = cluster.clusterSize ?? cluster.size ?? 0;
  const size = Number(sizeRaw);
  const clusterSize = Number.isFinite(size) ? size : 0;

  const statements = Array.isArray(cluster.topStatements) ? cluster.topStatements : [];
  const withPrompt = statements
    .filter((s) => {
      const statement = asRecord(s);
      return typeof statement.prompt === 'string' && statement.prompt.trim();
    })
    .slice()
    .sort(
      (a, b) =>
        Math.abs((Number(asRecord(b).differenceScore) || 0) - 0) -
        Math.abs((Number(asRecord(a).differenceScore) || 0) - 0),
    );

  const collapseSpace = (text: unknown): string =>
    String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
  const truncate = (text: unknown, max = 110): string => {
    const clean = collapseSpace(text);
    if (clean.length <= max) return clean;
    return `${clean.slice(0, Math.max(0, max - 3))}...`;
  };

  const top = withPrompt[0] ? asRecord(withPrompt[0]) : null;
  const topPrompt = top ? truncate(top.prompt, 120) : '';
  const topDelta = top && Number.isFinite(Number(top.differenceScore)) ? Number(top.differenceScore) : null;
  const deltaText = topDelta == null ? '' : ` (Δ=${topDelta.toFixed(2)})`;

  const namePrefix = clusterSize >= 12 ? 'Large' : clusterSize >= 6 ? 'Mid' : clusterSize >= 1 ? 'Small' : 'Empty';
  const name = `${namePrefix} Group ${clusterIndex}`;

  const short = topPrompt
    ? `Top differentiator: "${topPrompt}"${deltaText}.`
    : clusterSize
      ? `Cluster ${clusterIndex} has ${clusterSize} participant(s).`
      : `Cluster ${clusterIndex} has no participants.`;

  const otherPrompts = withPrompt
    .slice(1, 4)
    .map((s) => `"${truncate(asRecord(s).prompt, 90)}"`)
    .filter(Boolean);
  const longParts = [];
  if (clusterSize) longParts.push(`This cluster has ${clusterSize} participant(s).`);
  if (topPrompt) longParts.push(`It stands out most on "${topPrompt}".`);
  if (otherPrompts.length) longParts.push(`Other differentiators: ${otherPrompts.join('; ')}.`);
  if (!longParts.length) longParts.push('Not enough statement data to summarize this cluster.');

  return { name, short, long: longParts.join(' ') };
};
