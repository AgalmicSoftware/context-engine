import {
  runUserPageAnalyzeActionController,
  runUserPageBookmarkActionController,
  runUserPageCacheRefreshActionController,
  type UserPageAnalyzeActionControllerPorts,
  type UserPageBookmarkActionControllerPorts,
  type UserPageCacheRefreshActionControllerPorts,
} from './userPageActionController';

describe('userPageActionController', () => {
  it('does not dispatch hidden, blocked, disabled, or unhandled analyze actions', () => {
    const dispatchAnalyze = jest.fn();

    expect(
      runUserPageAnalyzeActionController({
        plan: {
          blockedReason: 'minimized',
          shouldRenderAnalyzeAction: false,
        },
        ports: { dispatchAnalyze },
      }),
    ).toEqual({
      blockedReason: 'minimized',
      status: 'hidden',
    });
    expect(
      runUserPageAnalyzeActionController({
        plan: {
          blockedReason: 'ai-unavailable',
          shouldRenderAnalyzeAction: true,
        },
        ports: { dispatchAnalyze },
      }),
    ).toEqual({
      blockedReason: 'ai-unavailable',
      status: 'blocked',
    });
    expect(
      runUserPageAnalyzeActionController({
        plan: {
          blockedReason: 'none',
          disabled: true,
          shouldRenderAnalyzeAction: true,
        },
        ports: { dispatchAnalyze },
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(
      runUserPageAnalyzeActionController({
        plan: {
          blockedReason: 'none',
          shouldRenderAnalyzeAction: true,
        },
        ports: {},
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });

    expect(dispatchAnalyze).not.toHaveBeenCalled();
  });

  it('dispatches analyze through the injected port with preserved args', () => {
    const dispatchAnalyze = jest.fn() satisfies UserPageAnalyzeActionControllerPorts<
      [{ type: string }]
    >['dispatchAnalyze'];
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(
      runUserPageAnalyzeActionController({
        analyzeArgs: [event],
        event,
        plan: {
          blockedReason: 'none',
          disabled: false,
          shouldRenderAnalyzeAction: true,
        },
        ports: { dispatchAnalyze },
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchAnalyze).toHaveBeenCalledTimes(1);
    expect(dispatchAnalyze).toHaveBeenCalledWith(event);
  });

  it('does not dispatch hidden, blocked, disabled, or unhandled bookmark actions', () => {
    const dispatchBookmark = jest.fn();

    expect(
      runUserPageBookmarkActionController({
        plan: {
          blockedReason: 'owner-page',
          shouldRenderBookmarkAction: false,
        },
        ports: { dispatchBookmark },
      }),
    ).toEqual({
      blockedReason: 'owner-page',
      status: 'hidden',
    });
    expect(
      runUserPageBookmarkActionController({
        plan: {
          blockedReason: 'bookmark-unavailable',
          shouldRenderBookmarkAction: true,
        },
        ports: { dispatchBookmark },
      }),
    ).toEqual({
      blockedReason: 'bookmark-unavailable',
      status: 'blocked',
    });
    expect(
      runUserPageBookmarkActionController({
        plan: {
          blockedReason: 'none',
          disabled: true,
          shouldRenderBookmarkAction: true,
        },
        ports: { dispatchBookmark },
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(
      runUserPageBookmarkActionController({
        plan: {
          blockedReason: 'none',
          shouldRenderBookmarkAction: true,
        },
        ports: {},
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });

    expect(dispatchBookmark).not.toHaveBeenCalled();
  });

  it('dispatches bookmarks through the injected port with preserved args', () => {
    const dispatchBookmark = jest.fn() satisfies UserPageBookmarkActionControllerPorts<
      [{ type: string }]
    >['dispatchBookmark'];
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(
      runUserPageBookmarkActionController({
        bookmarkArgs: [event],
        event,
        plan: {
          blockedReason: 'none',
          disabled: false,
          shouldRenderBookmarkAction: true,
        },
        ports: { dispatchBookmark },
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchBookmark).toHaveBeenCalledTimes(1);
    expect(dispatchBookmark).toHaveBeenCalledWith(event);
  });

  it('does not dispatch hidden, blocked, disabled, or unhandled cache refresh actions', () => {
    const dispatchCacheRefresh = jest.fn();

    expect(
      runUserPageCacheRefreshActionController({
        plan: {
          blockedReason: 'minimized',
          shouldRenderCacheRefreshAction: false,
        },
        ports: { dispatchCacheRefresh },
      }),
    ).toEqual({
      blockedReason: 'minimized',
      status: 'hidden',
    });
    expect(
      runUserPageCacheRefreshActionController({
        plan: {
          blockedReason: 'cache-refresh-unavailable',
          shouldRenderCacheRefreshAction: true,
        },
        ports: { dispatchCacheRefresh },
      }),
    ).toEqual({
      blockedReason: 'cache-refresh-unavailable',
      status: 'blocked',
    });
    expect(
      runUserPageCacheRefreshActionController({
        plan: {
          blockedReason: 'none',
          disabled: true,
          shouldRenderCacheRefreshAction: true,
        },
        ports: { dispatchCacheRefresh },
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'disabled',
    });
    expect(
      runUserPageCacheRefreshActionController({
        plan: {
          blockedReason: 'none',
          shouldRenderCacheRefreshAction: true,
        },
        ports: {},
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'unhandled',
    });

    expect(dispatchCacheRefresh).not.toHaveBeenCalled();
  });

  it('dispatches cache refresh through the injected port with preserved args', () => {
    const dispatchCacheRefresh = jest.fn() satisfies UserPageCacheRefreshActionControllerPorts<
      [string, string]
    >['dispatchCacheRefresh'];
    const event = { preventDefault: jest.fn(), type: 'click' };

    expect(
      runUserPageCacheRefreshActionController({
        cacheRefreshArgs: ['0xsbt', 'session-a'] as [string, string],
        event,
        plan: {
          blockedReason: 'none',
          disabled: false,
          shouldRenderCacheRefreshAction: true,
        },
        ports: { dispatchCacheRefresh },
      }),
    ).toEqual({
      blockedReason: 'none',
      status: 'dispatched',
    });

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(dispatchCacheRefresh).toHaveBeenCalledTimes(1);
    expect(dispatchCacheRefresh).toHaveBeenCalledWith('0xsbt', 'session-a');
  });
});
