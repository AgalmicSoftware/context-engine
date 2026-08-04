import { getCompareSbtKey, getCompareSbtLabel } from '../../utilities/survey/compareUsers.js';

export interface CompareBookmark {
  address?: string;
  addressLower?: string;
  nickname?: string;
  label?: string;
  [key: string]: unknown;
}

type CompareMembership = {
  image?: string | null;
  imageUrl?: string | null;
  sbtInfo?: {
    image?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type CompareMembershipSubject = {
  sbts?: CompareMembership[];
  [key: string]: unknown;
};

const resolveMembershipKey = getCompareSbtKey as (entry?: unknown) => string;
const resolveMembershipLabel = getCompareSbtLabel as (entry?: unknown) => string;

export const buildNicknameByAddressMap = (bookmarks: CompareBookmark[] = []): Map<string, string> => {
  const map = new Map<string, string>();
  (Array.isArray(bookmarks) ? bookmarks : []).forEach((entry) => {
    const lower = String(entry?.addressLower || entry?.address || '')
      .toLowerCase()
      .trim();
    const nickname = typeof entry?.nickname === 'string' ? entry.nickname.trim() : '';
    if (!lower || !nickname || map.has(lower)) return;
    map.set(lower, nickname);
  });
  return map;
};

export const buildCompareSbtKeySets = (users: CompareMembershipSubject[] = []): Set<string>[] =>
  (users || []).map((user) => {
    const set = new Set<string>();
    (user?.sbts || []).forEach((membership) => {
      const key = resolveMembershipKey(membership);
      if (key) set.add(key);
    });
    return set;
  });

export const buildCompareSbtImageMap = (
  users: CompareMembershipSubject[] = [],
): Map<string, { name: string; image: string | null }> => {
  const imageByMembership = new Map<string, { name: string; image: string | null }>();
  (Array.isArray(users) ? users : []).forEach((user) => {
    (Array.isArray(user?.sbts) ? user.sbts : []).forEach((membership) => {
      const key = resolveMembershipKey(membership);
      if (!key) return;
      const image = membership?.image || membership?.sbtInfo?.image || membership?.imageUrl || null;
      const name = resolveMembershipLabel(membership) || key;
      if (!imageByMembership.has(key)) imageByMembership.set(key, { name, image });
    });
  });
  return imageByMembership;
};
