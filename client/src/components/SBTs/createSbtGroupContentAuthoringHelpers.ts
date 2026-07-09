import { normalizeTagList } from '../../utilities/defaultTags.js';

export type CreateSbtRelevantDefaultTagSyncState = {
  autoAppliedDefaultTags: unknown[];
  dismissedDefaultTags: unknown;
  tags: string[];
  showTagsInput: boolean;
  shouldUpdate: boolean;
};

export type CreateSbtTagRemovalState = {
  autoAppliedDefaultTags: unknown[];
  dismissedDefaultTags: unknown;
  tags: unknown[];
};

export type CreateSbtTagAdditionState = CreateSbtTagRemovalState & {
  currentTagInput: string;
  showTagsInput: boolean;
};

export type ResolveCreateSbtTagInputStateArgs = {
  currentTagInput?: unknown;
};

export type CreateSbtTagInputState = {
  shouldShowAddTagButton: boolean;
};

export type BuildCreateSbtDocumentUrlAdditionPatchArgs = {
  documentURLs?: unknown;
  documentUrl?: unknown;
};

export type ResolveCreateSbtDocumentUrlInputStateArgs = {
  documentURLs?: unknown;
  documentUrl?: unknown;
  maxDocumentUrls?: number;
};

export type CreateSbtDocumentUrlInputState = {
  canAddDocumentUrl: boolean;
  documentUrlCount: number;
};

export type BuildCreateSbtDocumentUrlRemovalPatchArgs = {
  documentURLs?: unknown;
  index?: unknown;
};

export const buildUniqueTagList = (rawTags: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(rawTags) ? rawTags : []).forEach((raw: unknown) => {
    const trimmed = String(raw ?? '').trim();
    const normalized = trimmed.toLowerCase();
    if (!trimmed || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(trimmed);
  });
  return out;
};

export const parseDefaultSbtTags = (value: unknown): string[] => {
  if (typeof value !== 'string' || value.trim().length === 0) return [];
  return value
    .split(',')
    .map((tag: string) => tag.trim())
    .filter(Boolean);
};

export const normalizeCreateSbtRestoredTags = (tags: unknown = []): unknown[] => {
  if (Array.isArray(tags)) return tags;
  return parseDefaultSbtTags(tags);
};

export const buildCreateSbtTokenTagList = (tags: string[] = []): string[] =>
  tags.filter((tag) => tag.trim().length > 0);

export const buildCreateSbtMetadataPreviewTagList = (tags: unknown = []): unknown[] =>
  (Array.isArray(tags) ? tags : []).filter((tag: unknown) => String(tag || '').trim().length > 0);

export const buildCreateSbtDocumentIdHashList = (documentIdHashesDraft = ''): string[] =>
  documentIdHashesDraft.trim().length > 0 ? documentIdHashesDraft.split(',').map((docIdHash) => docIdHash.trim()) : [];

export const buildCreateSbtCurrentTagInputPatch = ({
  value = '',
}: {
  value?: unknown;
} = {}): Record<string, string> => ({
  currentTagInput: String(value ?? ''),
});

export const buildCreateSbtTagAdditionState = ({
  autoAppliedDefaultTags = [],
  dismissedDefaultTags = [],
  tagValue = '',
  tags = [],
}: {
  autoAppliedDefaultTags?: unknown;
  dismissedDefaultTags?: unknown;
  tagValue?: unknown;
  tags?: unknown;
} = {}): CreateSbtTagAdditionState => {
  const nextTag = String(tagValue || '').trim();
  const nextTagLower = nextTag.toLowerCase();
  return {
    tags: [...(Array.isArray(tags) ? tags : []), nextTag],
    currentTagInput: '',
    autoAppliedDefaultTags: (Array.isArray(autoAppliedDefaultTags) ? autoAppliedDefaultTags : []).filter(
      (tag: unknown) =>
        String(tag || '')
          .trim()
          .toLowerCase() !== nextTagLower,
    ),
    dismissedDefaultTags: (Array.isArray(dismissedDefaultTags) ? dismissedDefaultTags : []).filter(
      (tag: unknown) =>
        String(tag || '')
          .trim()
          .toLowerCase() !== nextTagLower,
    ),
    showTagsInput: true,
  };
};

export const buildCreateSbtTagRemovalState = ({
  autoAppliedDefaultTags = [],
  defaultTags = [],
  dismissedDefaultTags = [],
  indexToRemove = 0,
  removedTag = '',
  tags = [],
}: {
  autoAppliedDefaultTags?: unknown;
  defaultTags?: unknown;
  dismissedDefaultTags?: unknown;
  indexToRemove?: unknown;
  removedTag?: unknown;
  tags?: unknown;
} = {}): CreateSbtTagRemovalState => {
  const removeIndex = Number(indexToRemove);
  const removedTagLower = String(removedTag || '')
    .trim()
    .toLowerCase();
  const defaultTagLowerSet = new Set<string>(normalizeTagList(defaultTags));
  const currentDismissed = Array.isArray(dismissedDefaultTags) ? dismissedDefaultTags : [];
  return {
    tags: (Array.isArray(tags) ? tags : []).filter((_: unknown, i: number) => i !== removeIndex),
    autoAppliedDefaultTags: (Array.isArray(autoAppliedDefaultTags) ? autoAppliedDefaultTags : []).filter(
      (tag: unknown) =>
        String(tag || '')
          .trim()
          .toLowerCase() !== removedTagLower,
    ),
    dismissedDefaultTags: defaultTagLowerSet.has(removedTagLower)
      ? buildUniqueTagList([...currentDismissed, removedTag])
      : currentDismissed,
  };
};

export const resolveCreateSbtTagInputState = ({
  currentTagInput = '',
}: ResolveCreateSbtTagInputStateArgs = {}): CreateSbtTagInputState => ({
  shouldShowAddTagButton: String(currentTagInput || '').trim().length > 0,
});

const normalizedTagListsEqual = (left: unknown, right: unknown): boolean => {
  const leftNormalized = normalizeTagList(left);
  const rightNormalized = normalizeTagList(right);
  return (
    leftNormalized.length === rightNormalized.length &&
    leftNormalized.every((tag: string, index: number) => tag === rightNormalized[index])
  );
};

export const buildCreateSbtRelevantDefaultTagSyncState = ({
  autoAppliedDefaultTags = [],
  currentShowTagsInput = false,
  dismissedDefaultTags = [],
  relevantDefaults = [],
  resetDismissed = false,
  tags = [],
}: {
  autoAppliedDefaultTags?: unknown;
  currentShowTagsInput?: unknown;
  dismissedDefaultTags?: unknown;
  relevantDefaults?: unknown;
  resetDismissed?: unknown;
  tags?: unknown;
} = {}): CreateSbtRelevantDefaultTagSyncState => {
  const prevAutoLower = new Set<string>(normalizeTagList(autoAppliedDefaultTags));
  const nextDismissed = resetDismissed ? [] : dismissedDefaultTags || [];
  const dismissedLower = new Set<string>(normalizeTagList(nextDismissed));
  const currentTags = Array.isArray(tags) ? tags : [];
  const baseTags = currentTags.filter(
    (tag: unknown) =>
      !prevAutoLower.has(
        String(tag || '')
          .trim()
          .toLowerCase(),
      ),
  );
  const nextTags = buildUniqueTagList(baseTags);
  const currentTagLower = new Set<string>(normalizeTagList(nextTags));
  const nextAuto: string[] = [];
  const nextAutoLower = new Set<string>();

  (Array.isArray(relevantDefaults) ? relevantDefaults : []).forEach((tag: unknown) => {
    const tagString = String(tag || '').trim();
    const lower = tagString.toLowerCase();
    if (!lower || dismissedLower.has(lower) || nextAutoLower.has(lower)) return;
    if (currentTagLower.has(lower)) return;
    currentTagLower.add(lower);
    nextAuto.push(tagString);
    nextAutoLower.add(lower);
    nextTags.push(tagString);
  });

  const showTagsInput = nextTags.length > 0;
  const shouldUpdate = !(
    normalizedTagListsEqual(currentTags, nextTags) &&
    normalizedTagListsEqual(autoAppliedDefaultTags, nextAuto) &&
    normalizedTagListsEqual(dismissedDefaultTags, nextDismissed) &&
    !!currentShowTagsInput === showTagsInput
  );

  return {
    tags: nextTags,
    autoAppliedDefaultTags: nextAuto,
    dismissedDefaultTags: nextDismissed,
    showTagsInput,
    shouldUpdate,
  };
};

export const buildCreateSbtRelevantDefaultTagSyncPatch = ({
  autoAppliedDefaultTags = [],
  dismissedDefaultTags = [],
  showTagsInput = false,
  tags = [],
}: {
  autoAppliedDefaultTags?: unknown;
  dismissedDefaultTags?: unknown;
  showTagsInput?: unknown;
  tags?: unknown;
} = {}): Record<string, unknown> => ({
  tags,
  autoAppliedDefaultTags,
  dismissedDefaultTags,
  showTagsInput,
});

export const normalizeCreateSbtDocumentUrlDraft = (value: unknown = ''): string => String(value || '').trim();

export const buildEffectiveCreateSbtDocumentUrls = ({
  documentURLs = [],
  documentUrl = '',
  maxDocumentUrls = 10,
}: {
  documentURLs?: unknown;
  documentUrl?: unknown;
  maxDocumentUrls?: number;
} = {}): string[] => {
  const nextDocumentUrls = Array.isArray(documentURLs)
    ? documentURLs.map((url: unknown) => String(url || '').trim()).filter(Boolean)
    : [];
  const pendingDocumentUrl = normalizeCreateSbtDocumentUrlDraft(documentUrl);
  if (pendingDocumentUrl && nextDocumentUrls.length < maxDocumentUrls) {
    nextDocumentUrls.push(pendingDocumentUrl);
  }
  return nextDocumentUrls;
};

export const resolveCreateSbtDocumentUrlInputState = ({
  documentURLs = [],
  documentUrl = '',
  maxDocumentUrls = 10,
}: ResolveCreateSbtDocumentUrlInputStateArgs = {}): CreateSbtDocumentUrlInputState => {
  const documentUrlCount = Array.isArray(documentURLs) ? documentURLs.length : 0;
  return {
    canAddDocumentUrl: normalizeCreateSbtDocumentUrlDraft(documentUrl) !== '' && documentUrlCount < maxDocumentUrls,
    documentUrlCount,
  };
};

export const removeCreateSbtDocumentUrlAtIndex = (documentURLs: unknown = [], indexToRemove: unknown = 0): string[] => {
  const nextDocumentUrls = Array.isArray(documentURLs) ? [...documentURLs] : [];
  nextDocumentUrls.splice(Number(indexToRemove), 1);
  return nextDocumentUrls as string[];
};

export const buildCreateSbtDocumentUrlAdditionPatch = ({
  documentURLs = [],
  documentUrl = '',
}: BuildCreateSbtDocumentUrlAdditionPatchArgs = {}): Record<string, unknown> => ({
  documentURLs: [...(Array.isArray(documentURLs) ? documentURLs : []), String(documentUrl || '')],
  documentUrl: '',
});

export const buildCreateSbtDocumentUrlRemovalPatch = ({
  documentURLs = [],
  index = 0,
}: BuildCreateSbtDocumentUrlRemovalPatchArgs = {}): Record<string, unknown> => ({
  documentURLs: removeCreateSbtDocumentUrlAtIndex(documentURLs, index),
});
