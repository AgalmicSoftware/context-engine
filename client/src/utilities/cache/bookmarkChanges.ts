type BookmarkRecord = Record<string, unknown>;
export type BookmarkList = 'questions' | 'surveys' | 'sbts';

const sameId = (left: unknown, right: unknown): boolean => String(left).toLowerCase() === String(right).toLowerCase();

const listOf = (saved: unknown, list: BookmarkList): unknown[] => {
  const entries = saved && typeof saved === 'object' ? (saved as BookmarkRecord)[list] : null;
  return Array.isArray(entries) ? entries : [];
};

export const hasBookmark = (saved: unknown, list: BookmarkList, id: unknown): boolean =>
  listOf(saved, list).some((entry) => sameId(entry, id));

/**
 * Adds or removes one bookmark. Bookmarks are the person's own data, so save a
 * change with updateCacheAtomic('bookmarksCache', slug, (saved) => applyBookmarkChange(saved, ...)):
 * it applies the change to the latest saved bookmarks and keeps another tab's.
 */
export const applyBookmarkChange = (
  saved: unknown,
  list: BookmarkList,
  id: unknown,
  bookmarked: boolean,
): BookmarkRecord => {
  const record: BookmarkRecord = saved && typeof saved === 'object' && !Array.isArray(saved) ? { ...saved } : {};
  const entries = listOf(saved, list);
  if (hasBookmark(saved, list, id) === bookmarked) return { ...record, [list]: [...entries] };
  return { ...record, [list]: bookmarked ? [...entries, id] : entries.filter((entry) => !sameId(entry, id)) };
};
