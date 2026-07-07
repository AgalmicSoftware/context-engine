import {
  buildCreateSbtCurrentTagInputPatch,
  buildCreateSbtDocumentIdHashList,
  buildCreateSbtDocumentUrlAdditionPatch,
  buildCreateSbtDocumentUrlRemovalPatch,
  buildCreateSbtMetadataPreviewTagList,
  buildCreateSbtRelevantDefaultTagSyncPatch,
  buildCreateSbtRelevantDefaultTagSyncState,
  buildCreateSbtTagAdditionState,
  buildCreateSbtTagRemovalState,
  buildCreateSbtTokenTagList,
  buildEffectiveCreateSbtDocumentUrls,
  buildUniqueTagList,
  normalizeCreateSbtDocumentUrlDraft,
  normalizeCreateSbtRestoredTags,
  parseDefaultSbtTags,
  removeCreateSbtDocumentUrlAtIndex,
  resolveCreateSbtDocumentUrlInputState,
  resolveCreateSbtTagInputState,
} from './createSbtGroupContentAuthoringHelpers';

describe('createSbtGroupContentAuthoringHelpers', () => {
  it('normalizes tag lists and tag input patches', () => {
    expect(buildUniqueTagList([' Alpha ', 'alpha', 'Beta', '', null, ' beta '])).toEqual(['Alpha', 'Beta']);
    expect(parseDefaultSbtTags(' alpha, beta ,,Gamma ')).toEqual(['alpha', 'beta', 'Gamma']);
    expect(normalizeCreateSbtRestoredTags(' alpha, beta ,,Gamma ')).toEqual(['alpha', 'beta', 'Gamma']);
    expect(buildCreateSbtTokenTagList(['Alpha', '', '  ', 'Beta'])).toEqual(['Alpha', 'Beta']);
    expect(buildCreateSbtMetadataPreviewTagList(['Alpha', '', '  ', 'Beta', 7])).toEqual(['Alpha', 'Beta', 7]);
    expect(buildCreateSbtCurrentTagInputPatch({ value: null })).toEqual({
      currentTagInput: '',
    });
    expect(resolveCreateSbtTagInputState({ currentTagInput: ' Tag ' })).toEqual({
      shouldShowAddTagButton: true,
    });
  });

  it('adds, removes, and syncs default tags', () => {
    expect(
      buildCreateSbtTagAdditionState({
        autoAppliedDefaultTags: ['Alpha'],
        dismissedDefaultTags: ['Alpha'],
        tagValue: ' Alpha ',
        tags: ['Beta'],
      }),
    ).toEqual({
      tags: ['Beta', 'Alpha'],
      currentTagInput: '',
      autoAppliedDefaultTags: [],
      dismissedDefaultTags: [],
      showTagsInput: true,
    });

    expect(
      buildCreateSbtTagRemovalState({
        autoAppliedDefaultTags: ['Alpha'],
        defaultTags: ['Alpha', 'Gamma'],
        dismissedDefaultTags: [],
        indexToRemove: 0,
        removedTag: 'Alpha',
        tags: ['Alpha', 'Beta'],
      }),
    ).toEqual({
      tags: ['Beta'],
      autoAppliedDefaultTags: [],
      dismissedDefaultTags: ['Alpha'],
    });

    const sync = buildCreateSbtRelevantDefaultTagSyncState({
      autoAppliedDefaultTags: ['Old'],
      currentShowTagsInput: false,
      dismissedDefaultTags: ['Skip'],
      relevantDefaults: ['New', 'Skip', 'new'],
      tags: ['Manual', 'Old'],
    });
    expect(sync).toMatchObject({
      tags: ['Manual', 'New'],
      autoAppliedDefaultTags: ['New'],
      dismissedDefaultTags: ['Skip'],
      showTagsInput: true,
      shouldUpdate: true,
    });
    expect(buildCreateSbtRelevantDefaultTagSyncPatch(sync)).toEqual({
      tags: ['Manual', 'New'],
      autoAppliedDefaultTags: ['New'],
      dismissedDefaultTags: ['Skip'],
      showTagsInput: true,
    });
  });

  it('normalizes document hashes and URL draft state', () => {
    expect(buildCreateSbtDocumentIdHashList(' hash-a, hash-b ,, ')).toEqual(['hash-a', 'hash-b', '', '']);
    expect(normalizeCreateSbtDocumentUrlDraft(' https://docs.example/a ')).toBe('https://docs.example/a');
    expect(
      buildEffectiveCreateSbtDocumentUrls({
        documentURLs: [' a ', '', 'b'],
        documentUrl: ' c ',
      }),
    ).toEqual(['a', 'b', 'c']);
    expect(
      buildEffectiveCreateSbtDocumentUrls({
        documentURLs: ['a', 'b'],
        documentUrl: 'c',
        maxDocumentUrls: 2,
      }),
    ).toEqual(['a', 'b']);
    expect(
      resolveCreateSbtDocumentUrlInputState({
        documentURLs: ['a'],
        documentUrl: ' b ',
        maxDocumentUrls: 2,
      }),
    ).toEqual({
      canAddDocumentUrl: true,
      documentUrlCount: 1,
    });
  });

  it('builds document URL add/remove patches', () => {
    expect(
      buildCreateSbtDocumentUrlAdditionPatch({
        documentURLs: ['a'],
        documentUrl: 'b',
      }),
    ).toEqual({
      documentURLs: ['a', 'b'],
      documentUrl: '',
    });
    expect(removeCreateSbtDocumentUrlAtIndex(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(
      buildCreateSbtDocumentUrlRemovalPatch({
        documentURLs: ['a', 'b'],
        index: 0,
      }),
    ).toEqual({
      documentURLs: ['b'],
    });
  });
});
