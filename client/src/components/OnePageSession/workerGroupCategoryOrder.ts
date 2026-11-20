import type { WorkerGroup } from '../../domains/worker/workerGroupPorts';

export type WorkerGroupEntry = { group: WorkerGroup; isMember: boolean };
export type WorkerGroupCategory = { key: string; name: string; entries: WorkerGroupEntry[] };

const OTHER_KEY = '';
// The tags a new session gives its create forms (DEFAULT_NEW_SESSION_SBT_TAGS in the session wizard). A group that
// still carries exactly these was made without choosing tags, so it has no category rather than one called "Group".
export const UNCHOSEN_GROUP_TAGS = ['group', 'event', 'idea', 'demographic', 'location'];
// "Another country", "Other role": the catch-all goes last in its category.
const CATCH_ALL = /^(another|other)\b/i;

// "ai-agents" reads "Ai agents"; a tag keeps its own case otherwise, so a host can write "AI agents".
const categoryName = (tag: string): string => {
  const words = tag.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const byName = (a: WorkerGroupEntry, b: WorkerGroupEntry): number =>
  Number(CATCH_ALL.test(a.group.label)) - Number(CATCH_ALL.test(b.group.label)) ||
  a.group.label.localeCompare(b.group.label, undefined, { numeric: true, sensitivity: 'base' });

/**
 * The one place that decides categories, their names and their order.
 * A session's groups by the first tag each carries, A–Z by name, untagged groups last as "Other groups".
 * None when that makes fewer than two categories, as when no group carries a tag: the list then shows as it
 * always has, since one heading over every group sorts nothing.
 */
export const groupWorkerGroupsByCategory = (entries: WorkerGroupEntry[]): WorkerGroupCategory[] => {
  const categories = new Map<string, WorkerGroupCategory>();
  entries.forEach((entry) => {
    const tags = (entry.group.tags || []).map((value) => value.trim()).filter(Boolean);
    const unchosen =
      tags.length === UNCHOSEN_GROUP_TAGS.length &&
      UNCHOSEN_GROUP_TAGS.every((tag) => tags.some((value) => value.toLowerCase() === tag));
    const tag = unchosen ? '' : tags[0] || '';
    const key = tag.toLowerCase();
    const category = categories.get(key) || { key, name: tag ? categoryName(tag) : 'Other groups', entries: [] };
    category.entries.push(entry);
    categories.set(key, category);
  });
  if (categories.size < 2) return [];
  return [...categories.values()]
    .map((category) => ({ ...category, entries: [...category.entries].sort(byName) }))
    .sort(
      (a, b) =>
        Number(a.key === OTHER_KEY) - Number(b.key === OTHER_KEY) ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
};
