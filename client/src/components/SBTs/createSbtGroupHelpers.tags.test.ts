import {
  buildCreateSbtCurrentTagInputPatch,
  buildCreateSbtDocumentIdHashList,
  buildCreateSbtMetadataPreviewTagList,
  buildCreateSbtRelevantDefaultTagSyncPatch,
  buildCreateSbtRelevantDefaultTagSyncState,
  buildCreateSbtTagAdditionState,
  buildCreateSbtTagRemovalState,
  buildCreateSbtTokenTagList,
  buildUniqueTagList,
  normalizeAddressList,
  normalizeCreateSbtRestoredTags,
  parseDefaultSbtTags,
  resolveCreateSbtTagInputState,
} from './createSbtGroupHelpers';

describe('createSbtGroupHelpers tag helpers', () => {
  it('deduplicates address lists case-insensitively', () => {
    expect(normalizeAddressList([' 0xA ', '0xa', '0xB', '', null])).toEqual(['0xA', '0xB']);
  });

  it('deduplicates tag lists case-insensitively while preserving first casing', () => {
    expect(buildUniqueTagList([' Alpha ', 'alpha', 'Beta', '', null, ' beta '])).toEqual(['Alpha', 'Beta']);
    expect(buildUniqueTagList('bad')).toEqual([]);
    expect(parseDefaultSbtTags(' alpha, beta ,,Gamma ')).toEqual(['alpha', 'beta', 'Gamma']);
    expect(parseDefaultSbtTags('  ')).toEqual([]);
    expect(parseDefaultSbtTags(['alpha'])).toEqual([]);
    expect(normalizeCreateSbtRestoredTags([' Alpha ', '', null])).toEqual([' Alpha ', '', null]);
    expect(normalizeCreateSbtRestoredTags(' alpha, beta ,,Gamma ')).toEqual(['alpha', 'beta', 'Gamma']);
    expect(normalizeCreateSbtRestoredTags(null)).toEqual([]);
    expect(buildCreateSbtTokenTagList(['Alpha', '', '  ', 'Beta'])).toEqual(['Alpha', 'Beta']);
    expect(buildCreateSbtMetadataPreviewTagList(['Alpha', '', '  ', 'Beta', 7])).toEqual(['Alpha', 'Beta', 7]);
    expect(buildCreateSbtMetadataPreviewTagList('bad')).toEqual([]);
    expect(buildCreateSbtCurrentTagInputPatch({ value: 'Alpha' })).toEqual({
      currentTagInput: 'Alpha',
    });
    expect(buildCreateSbtCurrentTagInputPatch({ value: null })).toEqual({
      currentTagInput: '',
    });
    expect(buildCreateSbtDocumentIdHashList(' hash-a, hash-b ,, ')).toEqual(['hash-a', 'hash-b', '', '']);
    expect(buildCreateSbtDocumentIdHashList('  ')).toEqual([]);
  });

  it('builds tag addition state while clearing matching default tag bookkeeping', () => {
    expect(
      resolveCreateSbtTagInputState({
        currentTagInput: ' Alpha ',
      }),
    ).toEqual({
      shouldShowAddTagButton: true,
    });
    expect(
      resolveCreateSbtTagInputState({
        currentTagInput: '   ',
      }),
    ).toEqual({
      shouldShowAddTagButton: false,
    });
    expect(
      buildCreateSbtTagAdditionState({
        autoAppliedDefaultTags: ['Auto', 'Keep'],
        dismissedDefaultTags: ['auto', 'Other'],
        tagValue: ' Auto ',
        tags: ['Manual'],
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['Keep'],
      currentTagInput: '',
      dismissedDefaultTags: ['Other'],
      showTagsInput: true,
      tags: ['Manual', 'Auto'],
    });
    expect(
      buildCreateSbtTagAdditionState({
        autoAppliedDefaultTags: 'bad',
        dismissedDefaultTags: null,
        tagValue: 'Solo',
        tags: 'bad',
      }),
    ).toEqual({
      autoAppliedDefaultTags: [],
      currentTagInput: '',
      dismissedDefaultTags: [],
      showTagsInput: true,
      tags: ['Solo'],
    });
  });

  it('builds tag removal state with default-tag dismissal bookkeeping', () => {
    expect(
      buildCreateSbtTagRemovalState({
        autoAppliedDefaultTags: ['Auto', 'Keep'],
        defaultTags: ['Auto', 'Other'],
        dismissedDefaultTags: ['Existing'],
        indexToRemove: 1,
        removedTag: 'Auto',
        tags: ['Manual', 'Auto', 'Keep'],
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['Keep'],
      dismissedDefaultTags: ['Existing', 'Auto'],
      tags: ['Manual', 'Keep'],
    });
    expect(
      buildCreateSbtTagRemovalState({
        autoAppliedDefaultTags: ['Auto'],
        defaultTags: ['Default'],
        dismissedDefaultTags: ['Existing'],
        indexToRemove: 'bad',
        removedTag: 'Missing',
        tags: ['Manual', 'Auto'],
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: ['Existing'],
      tags: ['Manual', 'Auto'],
    });
  });

  it('builds relevant default tag sync state', () => {
    expect(
      buildCreateSbtRelevantDefaultTagSyncState({
        autoAppliedDefaultTags: [],
        currentShowTagsInput: false,
        dismissedDefaultTags: [],
        relevantDefaults: ['debate', 'governance', 'debate'],
        tags: [],
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['debate', 'governance'],
      dismissedDefaultTags: [],
      shouldUpdate: true,
      showTagsInput: true,
      tags: ['debate', 'governance'],
    });

    expect(
      buildCreateSbtRelevantDefaultTagSyncState({
        autoAppliedDefaultTags: ['debate', 'governance'],
        currentShowTagsInput: true,
        dismissedDefaultTags: ['debate'],
        relevantDefaults: ['debate', 'governance'],
        tags: ['Manual', 'debate', 'governance'],
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['governance'],
      dismissedDefaultTags: ['debate'],
      shouldUpdate: true,
      showTagsInput: true,
      tags: ['Manual', 'governance'],
    });

    expect(
      buildCreateSbtRelevantDefaultTagSyncState({
        autoAppliedDefaultTags: ['Auto'],
        currentShowTagsInput: true,
        dismissedDefaultTags: ['Dismissed'],
        relevantDefaults: ['Auto'],
        resetDismissed: true,
        tags: ['Auto'],
      }),
    ).toEqual({
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: [],
      shouldUpdate: true,
      showTagsInput: true,
      tags: ['Auto'],
    });

    expect(
      buildCreateSbtRelevantDefaultTagSyncState({
        autoAppliedDefaultTags: ['Auto'],
        currentShowTagsInput: true,
        dismissedDefaultTags: [],
        relevantDefaults: ['Auto'],
        tags: ['Auto'],
      }).shouldUpdate,
    ).toBe(false);
    expect(
      buildCreateSbtRelevantDefaultTagSyncPatch({
        autoAppliedDefaultTags: ['Auto'],
        dismissedDefaultTags: ['Dismissed'],
        showTagsInput: true,
        tags: ['Manual', 'Auto'],
      }),
    ).toEqual({
      tags: ['Manual', 'Auto'],
      autoAppliedDefaultTags: ['Auto'],
      dismissedDefaultTags: ['Dismissed'],
      showTagsInput: true,
    });
  });
});
