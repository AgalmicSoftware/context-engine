import {
  buildSbtPageSectionHeaderClassName,
  resolveSbtPageBookmarkButtonDisplayState,
  resolveSbtPageCopyErrorButtonStyle,
  resolveSbtPageCopyIconState,
  resolveSbtPageFullViewShellState,
  resolveSbtPageIdentityPanelDisplayState,
  resolveSbtPageInlineLockIconStyle,
  resolveSbtPageInteractiveCursorStyle,
  resolveSbtPageItalicNoteStyle,
  resolveSbtPageMutedInfoIconStyle,
  resolveSbtPageQuestionIconStyle,
  resolveSbtPageRefreshIndicatorStyle,
  resolveSbtPageSectionToggleDisplayState,
} from './sbtPageFullViewDisplayHelpers';

describe('sbtPageFullViewDisplayHelpers', () => {
  it('resolves identity panel display descriptors without handlers', () => {
    expect(
      resolveSbtPageIdentityPanelDisplayState({
        defaultImage: '/default.png',
        fallbackState: {},
        sbtInfo: {
          name: 'Access Badge',
          description: '',
          image: 'https://example.test/badge.png',
          descriptionLocked: true,
        },
        unnamedLabel: 'Unnamed Group',
      }),
    ).toEqual({
      descriptionText: '[encrypted]',
      displayImageState: {
        sourceKey: 'https://example.test/badge.png',
        candidates: ['https://example.test/badge.png'],
        activeIndex: 0,
        src: 'https://example.test/badge.png',
        canRetry: true,
      },
      imageAlt: 'Access Badge',
      imageUrl: 'https://example.test/badge.png',
      nameText: 'Access Badge',
      showDescriptionLockIcon: true,
    });

    expect(
      resolveSbtPageIdentityPanelDisplayState({
        defaultImage: '/default.png',
        sbtInfo: {
          description: 'Visible copy',
          image: '',
        },
        unnamedLabel: 'Unnamed Group',
      }),
    ).toEqual({
      descriptionText: 'Visible copy',
      displayImageState: {
        sourceKey: '',
        candidates: [],
        activeIndex: 0,
        src: '/default.png',
        canRetry: false,
      },
      imageAlt: 'Unnamed Group',
      imageUrl: '/default.png',
      nameText: 'Unnamed Group',
      showDescriptionLockIcon: false,
    });
  });

  it('resolves full SBT page shell display states', () => {
    expect(
      resolveSbtPageFullViewShellState({
        hasSbtAddress: false,
        sbtInfo: { name: 'Hidden' },
      }),
    ).toEqual({
      shouldRenderContent: false,
      shouldRenderError: false,
      shouldRenderLoading: false,
      shouldRenderMissingAddress: true,
    });
    expect(
      resolveSbtPageFullViewShellState({
        error: 'failed',
        hasSbtAddress: true,
      }),
    ).toEqual({
      shouldRenderContent: false,
      shouldRenderError: true,
      shouldRenderLoading: false,
      shouldRenderMissingAddress: false,
    });
    expect(
      resolveSbtPageFullViewShellState({
        hasSbtAddress: true,
      }),
    ).toEqual({
      shouldRenderContent: false,
      shouldRenderError: false,
      shouldRenderLoading: true,
      shouldRenderMissingAddress: false,
    });
    expect(
      resolveSbtPageFullViewShellState({
        error: 'stale',
        hasSbtAddress: true,
        sbtInfo: { name: 'Loaded' },
      }),
    ).toEqual({
      shouldRenderContent: true,
      shouldRenderError: false,
      shouldRenderLoading: false,
      shouldRenderMissingAddress: false,
    });
  });

  it('resolves full-view controls and inline styles', () => {
    expect(resolveSbtPageSectionToggleDisplayState({ open: true })).toEqual({
      isOpen: true,
      shouldRenderClosedIcon: false,
      shouldRenderOpenIcon: true,
    });
    expect(resolveSbtPageSectionToggleDisplayState({ open: false })).toEqual({
      isOpen: false,
      shouldRenderClosedIcon: true,
      shouldRenderOpenIcon: false,
    });
    expect(
      buildSbtPageSectionHeaderClassName({
        baseClassName: 'section-header',
        roundedClassName: 'rounded-header',
      }),
    ).toBe('section-header rounded-header');
    expect(resolveSbtPageBookmarkButtonDisplayState({ bookmarked: true })).toEqual({
      iconStyle: { color: '#FFD700' },
    });
    expect(resolveSbtPageBookmarkButtonDisplayState({ bookmarked: false })).toEqual({
      iconStyle: { color: undefined },
    });
    expect(resolveSbtPageInteractiveCursorStyle()).toEqual({ cursor: 'pointer' });
    expect(resolveSbtPageQuestionIconStyle()).toEqual({
      marginLeft: '5px',
      color: '#00ff9d',
      cursor: 'pointer',
      opacity: 0.5,
    });
    expect(resolveSbtPageItalicNoteStyle()).toEqual({ fontStyle: 'italic' });
    expect(resolveSbtPageCopyErrorButtonStyle()).toEqual({
      background: 'transparent',
      border: 'none',
      marginLeft: '8px',
      cursor: 'pointer',
    });
    expect(resolveSbtPageMutedInfoIconStyle()).toEqual({ opacity: 0.5 });
    expect(resolveSbtPageInlineLockIconStyle()).toEqual({ marginRight: '6px' });
    expect(resolveSbtPageRefreshIndicatorStyle()).toEqual({
      marginLeft: '10px',
      fontSize: '0.8em',
      opacity: 0.7,
    });
    expect(
      resolveSbtPageCopyIconState({
        copiedAddress: 'contract',
        targetKey: 'contract',
      }),
    ).toEqual({
      shouldRenderCopiedIcon: true,
      shouldRenderDefaultIcon: false,
    });
    expect(
      resolveSbtPageCopyIconState({
        copied: false,
        copiedAddress: 'contract',
        targetKey: 'contract',
      }),
    ).toEqual({
      shouldRenderCopiedIcon: false,
      shouldRenderDefaultIcon: true,
    });
  });
});
