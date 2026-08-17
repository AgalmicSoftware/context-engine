import { encodeStancesForUser, getCompareSbtKey, getCompareSbtLabel } from '../../utilities/survey/compareUsers.js';
import { buildCompareSbtImageMap } from './compareMembershipPresentation';

type UnknownRecord = Record<string, unknown>;

export type CompareVennDimension = 2 | 3;
export type CompareVennRegionKey = 'a' | 'b' | 'c' | 'ab' | 'ac' | 'bc' | 'abc';

export interface CompareVennUser extends UnknownRecord {
  questions?: Array<
    UnknownRecord & {
      id?: string;
      questionID?: string;
      questionId?: string;
      qId?: string;
      prompt?: string;
      title?: string;
      text?: string;
    }
  >;
  sbts?: UnknownRecord[];
}

export type CompareVennQuestionItem = {
  type: 'question';
  id: string;
  option: string | null;
  optionLabel: string | null;
  prompt: string;
  votes: Array<-1 | 0 | 1 | null>;
};

export type CompareVennMembershipItem = {
  type: 'membership';
  kind: 'sbt_onchain';
  name: string;
  image: string | null;
};

export type CompareVennItem = CompareVennQuestionItem | CompareVennMembershipItem;

export type CompareVennRegion = {
  key: CompareVennRegionKey;
  label: string;
  count: number;
  userIndices: number[];
  items: CompareVennItem[];
};

export type CompareVennModel = {
  dimension: CompareVennDimension;
  labels: string[];
  mode: 'opinion' | 'membership';
  regions: CompareVennRegion[];
  semantics: string;
};

export interface BuildCompareVennModelOptions {
  dimension: CompareVennDimension;
  sets?: Set<string>[];
  labels?: string[];
  users?: CompareVennUser[] | null;
  questionCaches?: unknown[];
  preCounts?: Partial<Record<CompareVennRegionKey, number>> | null;
  evidence?: Partial<Record<CompareVennRegionKey, unknown[]>> | null;
  semantics?: string | null;
}

const REGION_KEYS: Record<CompareVennDimension, CompareVennRegionKey[]> = {
  2: ['a', 'b', 'ab'],
  3: ['a', 'b', 'c', 'ab', 'ac', 'bc', 'abc'],
};

const REGION_USER_INDICES: Record<CompareVennRegionKey, number[]> = {
  a: [0],
  b: [1],
  c: [2],
  ab: [0, 1],
  ac: [0, 2],
  bc: [1, 2],
  abc: [0, 1, 2],
};

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const resolveMembershipKey = getCompareSbtKey as (entry?: unknown) => string;
const resolveMembershipLabel = getCompareSbtLabel as (entry?: unknown) => string;

export const shortenCompareQuestionId = (questionId: unknown): string => {
  const normalized = String(questionId || '').trim();
  if (normalized.length <= 10) return normalized;
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
};

export const buildCompareVennPromptMap = (
  users: CompareVennUser[] = [],
  questionCaches: unknown[] = [],
): Map<string, string> => {
  const promptById = new Map<string, string>();
  (Array.isArray(users) ? users : []).forEach((user) => {
    (Array.isArray(user?.questions) ? user.questions : []).forEach((question) => {
      const id = String(question?.id || question?.questionID || question?.questionId || question?.qId || '')
        .trim()
        .toLowerCase();
      const prompt = String(question?.prompt || question?.title || question?.text || '').trim();
      if (id && prompt && !promptById.has(id)) promptById.set(id, prompt);
    });
  });

  (Array.isArray(questionCaches) ? questionCaches : []).forEach((cacheValue) => {
    const cache = toRecord(cacheValue);
    Object.keys(cache).forEach((networkKey) => {
      const questions = toRecord(toRecord(cache[networkKey]).questions);
      Object.keys(questions).forEach((cacheKey) => {
        const question = toRecord(questions[cacheKey]);
        const id = String(question.id || cacheKey || '')
          .trim()
          .toLowerCase();
        const prompt = String(question.prompt || question.title || question.text || '').trim();
        if (id && prompt && !promptById.has(id)) promptById.set(id, prompt);
      });
    });
  });

  return promptById;
};

const parseQuestionToken = (
  raw: unknown,
  promptById: Map<string, string>,
): Omit<CompareVennQuestionItem, 'votes'> | null => {
  const value = String(raw || '').trim();
  if (!value) return null;
  const parts = value.split(' · ');
  const head = String(parts.shift() || '').trim();
  const promptHint = parts.join(' · ').trim();
  const match = head.match(/^(.*)\s*\(([^)]+)\)\s*$/);
  if (!match) return null;
  const rawSign = String(match[2] || '')
    .replace(/\u2212/g, '-')
    .trim()
    .toLowerCase();
  if (!['+', '-', '+1', '-1', 'agree', 'disagree', 'unsure', 'neutral'].includes(rawSign)) return null;

  const token = String(match[1] || '').trim();
  if (!token) return null;
  const separatorIndex = token.indexOf('::');
  const id = String(separatorIndex >= 0 ? token.slice(0, separatorIndex) : token)
    .trim()
    .toLowerCase();
  const optionLabel = separatorIndex >= 0 ? token.slice(separatorIndex + 2).trim() : '';
  if (!id) return null;
  return {
    type: 'question',
    id,
    option: optionLabel ? optionLabel.toLowerCase() : null,
    optionLabel: optionLabel || null,
    prompt: promptById.get(id) || promptHint || '(Question)',
  };
};

const parseEvidenceList = ({
  rawList,
  promptById,
  imageByMembership,
}: {
  rawList: unknown;
  promptById: Map<string, string>;
  imageByMembership: Map<string, { name: string; image: string | null }>;
}): Array<Omit<CompareVennQuestionItem, 'votes'> | CompareVennMembershipItem> => {
  const items: Array<Omit<CompareVennQuestionItem, 'votes'> | CompareVennMembershipItem> = [];
  (Array.isArray(rawList) ? rawList : []).forEach((rawItem) => {
    if (typeof rawItem === 'string') {
      if (rawItem.startsWith('question:')) {
        const [, rawId] = rawItem.split(':');
        const id = String(rawId || '')
          .trim()
          .toLowerCase();
        if (id) {
          items.push({
            type: 'question',
            id,
            option: null,
            optionLabel: null,
            prompt: promptById.get(id) || '(Question)',
          });
        }
        return;
      }
      const question = parseQuestionToken(rawItem, promptById);
      if (question) {
        items.push(question);
        return;
      }
      const lookup = imageByMembership.get(rawItem.trim().toLowerCase());
      items.push({
        type: 'membership',
        kind: 'sbt_onchain',
        name: lookup?.name || rawItem,
        image: lookup?.image || null,
      });
      return;
    }

    if (!isRecord(rawItem)) return;
    const rawId = rawItem.questionId || rawItem.questionID || rawItem.qId || rawItem.id;
    const membershipName = resolveMembershipLabel(rawItem);
    if (rawId && !membershipName) {
      const id = String(rawId).trim().toLowerCase();
      const optionLabel = String(rawItem.option || rawItem.choice || rawItem.optionLabel || '').trim();
      items.push({
        type: 'question',
        id,
        option: optionLabel ? optionLabel.toLowerCase() : null,
        optionLabel: optionLabel || null,
        prompt: String(rawItem.prompt || '').trim() || promptById.get(id) || '(Question)',
      });
      return;
    }
    if (membershipName) {
      const key = resolveMembershipKey(rawItem) || membershipName;
      const lookup = imageByMembership.get(key);
      items.push({
        type: 'membership',
        kind: 'sbt_onchain',
        name: membershipName || lookup?.name || key,
        image:
          (typeof rawItem.image === 'string' && rawItem.image) ||
          (typeof toRecord(rawItem.sbtInfo).image === 'string' && String(toRecord(rawItem.sbtInfo).image)) ||
          lookup?.image ||
          null,
      });
    }
  });
  return items;
};

const intersect = (left: Set<string>, right: Set<string>): Set<string> => {
  const result = new Set<string>();
  left.forEach((value) => {
    if (right.has(value)) result.add(value);
  });
  return result;
};

const difference = (left: Set<string>, right: Set<string>): Set<string> => {
  const result = new Set<string>();
  left.forEach((value) => {
    if (!right.has(value)) result.add(value);
  });
  return result;
};

const buildMembershipRegions = (
  dimension: CompareVennDimension,
  sets: Set<string>[],
): Partial<Record<CompareVennRegionKey, Set<string>>> | null => {
  const [a, b, c] = sets;
  if (!(a instanceof Set) || !(b instanceof Set) || (dimension === 3 && !(c instanceof Set))) return null;
  if (dimension === 2) {
    return {
      a: difference(a, b),
      b: difference(b, a),
      ab: intersect(a, b),
    };
  }
  const abc = intersect(intersect(a, b), c);
  return {
    a: difference(difference(a, b), c),
    b: difference(difference(b, a), c),
    c: difference(difference(c, a), b),
    ab: difference(intersect(a, b), c),
    ac: difference(intersect(a, c), b),
    bc: difference(intersect(b, c), a),
    abc,
  };
};

const buildRegionLabel = (key: CompareVennRegionKey, labels: string[]): string => {
  const [a = 'A', b = 'B', c = 'C'] = labels;
  const values: Record<CompareVennRegionKey, string> = {
    a: `${a} only`,
    b: `${b} only`,
    c: `${c} only`,
    ab: `${a} & ${b}`,
    ac: `${a} & ${c}`,
    bc: `${b} & ${c}`,
    abc: `${a}, ${b} & ${c}`,
  };
  return values[key];
};

const buildQuestionVotes = (
  item: Omit<CompareVennQuestionItem, 'votes'>,
  userIndices: number[],
  encodedUsers: ReturnType<typeof encodeStancesForUser>[],
): Array<-1 | 0 | 1 | null> => {
  const token = item.option ? `${item.id}::${item.option}` : item.id;
  return userIndices.map((userIndex) => {
    const stance = encodedUsers[userIndex]?.tokens?.get(token);
    if (!stance) return null;
    if (stance.sign > 0) return 1;
    if (stance.sign < 0) return -1;
    return 0;
  });
};

const dedupeRegionItems = (items: CompareVennItem[]): CompareVennItem[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key =
      item.type === 'question'
        ? `question:${item.id}:${item.option || ''}`
        : `membership:${item.kind}:${item.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildCompareVennModel = (options: BuildCompareVennModelOptions): CompareVennModel | null => {
  const dimension = options.dimension;
  const users = (Array.isArray(options.users) ? options.users : []).slice(0, dimension);
  const labels = Array.from(
    { length: dimension },
    (_, index) => options.labels?.[index] || String.fromCharCode(65 + index),
  );
  const membershipRegions = buildMembershipRegions(dimension, Array.isArray(options.sets) ? options.sets : []);
  const hasOpinionCounts = Boolean(options.preCounts && typeof options.preCounts === 'object');
  if (!hasOpinionCounts && !membershipRegions) return null;

  const promptById = buildCompareVennPromptMap(users, options.questionCaches);
  const imageByMembership = buildCompareSbtImageMap(users);
  const encodedUsers = users.map((user) => encodeStancesForUser(user));
  const evidence = options.evidence || {};

  const regions = REGION_KEYS[dimension].map((key): CompareVennRegion => {
    const userIndices = REGION_USER_INDICES[key];
    const parsedItems = parseEvidenceList({
      rawList: evidence[key],
      promptById,
      imageByMembership,
    }).map((item): CompareVennItem =>
      item.type === 'question' ? { ...item, votes: buildQuestionVotes(item, userIndices, encodedUsers) } : item,
    );
    const fallbackMemberships: CompareVennMembershipItem[] = Array.from(membershipRegions?.[key] || []).map(
      (membershipKey) => {
        const lookup = imageByMembership.get(membershipKey);
        return {
          type: 'membership',
          kind: 'sbt_onchain',
          name: lookup?.name || membershipKey,
          image: lookup?.image || null,
        };
      },
    );
    const rawCount = hasOpinionCounts ? options.preCounts?.[key] : membershipRegions?.[key]?.size;
    const count = Number.isFinite(Number(rawCount)) ? Math.max(0, Number(rawCount)) : 0;
    return {
      key,
      label: buildRegionLabel(key, labels),
      count,
      userIndices,
      items: dedupeRegionItems([...parsedItems, ...fallbackMemberships]),
    };
  });

  const mode = hasOpinionCounts ? 'opinion' : 'membership';
  return {
    dimension,
    labels,
    mode,
    regions,
    semantics:
      options.semantics ||
      (mode === 'opinion'
        ? 'Counts = opinion-stance overlaps on the same question/token.'
        : 'Counts = on-chain SBT membership overlaps across participants.'),
  };
};
