import {
  buildSbtListExpandedCardShellClassName,
  buildSbtListFilterContainerClassName,
  buildSbtListFilterLabelClassName,
  buildSbtListLoadingGroupStatusClassName,
  buildSbtListLoadingProgressFillClassName,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRootClassName,
  buildSbtListSessionUniversePanelClassName,
  findSbtListInteractiveAncestor,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListLoadingProgressFillStyle,
  resolveSbtListRelativeImageStyle,
} from './sbtListDisplayHelpers';

describe('sbtListDisplayHelpers', () => {
  it('builds loading class names and styles', () => {
    expect(
      buildSbtListLoadingGroupStatusClassName({
        activeClassName: 'status-active',
        baseClassName: 'status',
        pendingClassName: 'status-pending',
        scanInProgress: true,
      }),
    ).toBe('status status-active');
    expect(
      buildSbtListLoadingGroupStatusClassName({
        activeClassName: 'status-active',
        baseClassName: 'status',
        pendingClassName: 'status-pending',
        scanInProgress: false,
      }),
    ).toBe('status status-pending');
    expect(
      buildSbtListLoadingProgressFillClassName({
        baseClassName: 'fill',
        hasLatest: false,
        indeterminateClassName: 'indeterminate',
      }),
    ).toBe('fill indeterminate');
    expect(
      resolveSbtListLoadingProgressFillStyle({
        hasLatest: true,
        progressPct: 42,
      }),
    ).toEqual({ width: '42%' });
    expect(
      resolveSbtListLoadingProgressFillStyle({
        hasLatest: false,
        progressPct: 42,
      }),
    ).toEqual({ width: undefined });
    expect(resolveSbtListRelativeImageStyle()).toEqual({ position: 'relative' });
    expect(resolveSbtListHeaderSpinnerWrapStyle()).toEqual({
      alignItems: 'center',
      display: 'flex',
      gap: '6px',
    });
    expect(resolveSbtListHeaderBlocksLeftStyle()).toEqual({
      fontSize: '0.85rem',
      opacity: 0.85,
    });
  });

  it('builds SBT list shell and filter class names', () => {
    expect(
      buildSbtListExpandedCardShellClassName({
        baseClassName: 'card',
        expandedClassName: 'card-expanded',
        isExpanded: true,
      }),
    ).toBe('card card-expanded');
    expect(
      buildSbtListExpandedCardShellClassName({
        baseClassName: 'card',
        expandedClassName: 'card-expanded',
        isExpanded: false,
      }),
    ).toBe('card');
    expect(
      buildSbtListRootClassName({
        baseClassName: 'base',
        rootClassName: 'root',
      }),
    ).toBe('base root');
    expect(
      buildSbtListSessionUniversePanelClassName({
        baseClassName: 'panel',
        closedClassName: 'panel-closed',
        isClosed: true,
      }),
    ).toBe('panel panel-closed');
    expect(
      buildSbtListMiniSettingsButtonClassName({
        activeClassName: 'settings-active',
        baseClassName: 'settings',
        isActive: true,
      }),
    ).toBe('settings settings-active');
    expect(
      buildSbtListFilterContainerClassName({
        baseClassName: 'filters',
        panelClassName: 'filters-panel',
      }),
    ).toBe('filters filters-panel');
    expect(
      buildSbtListFilterLabelClassName({
        activeClassName: 'filter-active',
        baseClassName: 'filter',
        isActive: true,
        toggleClassName: 'filter-toggle',
      }),
    ).toBe('filter filter-toggle filter-active');
  });

  it('finds interactive ancestors only for targets with closest support', () => {
    const card = document.createElement('article');
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.appendChild(icon);
    card.appendChild(button);

    expect(findSbtListInteractiveAncestor(icon, 'button')).toBe(button);
    expect(findSbtListInteractiveAncestor(card, 'button')).toBe(null);
    expect(findSbtListInteractiveAncestor({} as EventTarget, 'button')).toBe(null);
    expect(findSbtListInteractiveAncestor(null, 'button')).toBe(null);
  });
});
