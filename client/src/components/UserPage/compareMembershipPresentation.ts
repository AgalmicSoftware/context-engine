export interface CompareBookmark {
  address?: string;
  addressLower?: string;
  nickname?: string;
  label?: string;
  [key: string]: unknown;
}

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
