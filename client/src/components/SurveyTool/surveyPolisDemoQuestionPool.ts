import demoPolisData from '../../variables/demo/demo_polis_data.json';
import { LEGACY_DEMO_POLL_OPTIONS } from '../../utilities/demo/demoPolisDatasets';

type UnknownRecord = Record<string, unknown>;

export type PolisDemoQuestionPoolEntry = {
  id: string;
  prompt: string;
  type: string;
  tags: string[];
  sessionSlug: string;
  source: string;
  category?: string;
  key_tension?: string;
  sources?: string;
  nodeId?: string;
  options?: string[];
  singleSelect?: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown = ''): string => String(value || '').trim();

const normalizePathname = (value: unknown = ''): string =>
  readString(value).split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();

const isBuiltInDemoPathname = (value: unknown = ''): boolean => {
  const routePath = normalizePathname(value);
  return routePath === '/session/demo' || routePath.startsWith('/session/demo/');
};

const normalizePolisQuestionType = (value: unknown = ''): string => {
  const type = readString(value).toLowerCase();
  if (type === 'poll') return 'multichoice';
  return type || 'binary';
};

const readPollOptions = (comment: UnknownRecord, legacyFallback = false): string[] => {
  const options = legacyFallback ? LEGACY_DEMO_POLL_OPTIONS : Array.isArray(comment.options) ? comment.options : [];
  const seen = new Set<string>();
  return options.reduce<string[]>((out, option) => {
    const value = readString(option);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return out;
    seen.add(key);
    out.push(value);
    return out;
  }, []);
};

export const buildPolisDemoQuestionPool = (
  source: unknown = demoPolisData,
  { sessionSlug = '' }: { sessionSlug?: string } = {},
): PolisDemoQuestionPoolEntry[] => {
  const comments = isRecord(source) && Array.isArray(source.comments) ? source.comments.filter(isRecord) : [];

  return comments
    .map((comment, index) => {
      const id = readString(comment.commentId || `demo-polis-${index + 1}`).toLowerCase();
      const prompt = readString(comment.commentBody || comment.prompt || comment.question);
      if (!id || !prompt) return null;

      const category = readString(comment.category);
      const nodeId = readString(comment.nodeId);
      const tags = [category, nodeId].filter(Boolean);
      const keyTension = readString(comment.key_tension);
      const sources = readString(comment.sources);
      const type = normalizePolisQuestionType(comment.type);
      const options = type === 'multichoice' ? readPollOptions(comment, source === demoPolisData) : [];

      return {
        id,
        prompt,
        type,
        tags,
        sessionSlug,
        source: 'demo-polis-data',
        ...(category ? { category } : {}),
        ...(keyTension ? { key_tension: keyTension } : {}),
        ...(sources ? { sources } : {}),
        ...(nodeId ? { nodeId } : {}),
        ...(options.length ? { options, singleSelect: true } : {}),
      };
    })
    .filter((question): question is PolisDemoQuestionPoolEntry => !!question);
};

let memoizedDefaultPolisDemoQuestionPool: PolisDemoQuestionPoolEntry[] | null = null;

export const getPolisDemoQuestionPool = (): PolisDemoQuestionPoolEntry[] => {
  if (!memoizedDefaultPolisDemoQuestionPool) {
    memoizedDefaultPolisDemoQuestionPool = buildPolisDemoQuestionPool();
  }
  return memoizedDefaultPolisDemoQuestionPool;
};

export const shouldUseBuiltInPolisDemoQuestionPool = ({
  displaySlug = '',
  sourceSlug = '',
  pathname = '',
}: {
  displaySlug?: unknown;
  sourceSlug?: unknown;
  pathname?: unknown;
} = {}): boolean => {
  const isBuiltInDemoRoute = readString(displaySlug).toLowerCase() === 'demo' || isBuiltInDemoPathname(pathname);
  if (!isBuiltInDemoRoute) return false;
  return readString(sourceSlug).toLowerCase() === '' || isBuiltInDemoPathname(pathname);
};

export const resolvePolisDemoQuestionPool = ({
  displaySlug = '',
  sourceSlug = '',
  pathname = typeof window !== 'undefined' ? window.location?.pathname : '',
}: {
  displaySlug?: unknown;
  sourceSlug?: unknown;
  pathname?: unknown;
} = {}): PolisDemoQuestionPoolEntry[] =>
  shouldUseBuiltInPolisDemoQuestionPool({ displaySlug, sourceSlug, pathname }) ? getPolisDemoQuestionPool() : [];
