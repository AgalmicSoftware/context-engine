type BuildSbtListLoadingGroupStatusClassNameArgs = {
  activeClassName?: unknown;
  baseClassName?: unknown;
  pendingClassName?: unknown;
  scanInProgress?: unknown;
};
type BuildSbtListLoadingProgressFillClassNameArgs = {
  baseClassName?: unknown;
  hasLatest?: unknown;
  indeterminateClassName?: unknown;
};
type ResolveSbtListLoadingProgressFillStyleArgs = {
  hasLatest?: unknown;
  progressPct?: unknown;
};
type BuildSbtListExpandedCardShellClassNameArgs = {
  baseClassName?: unknown;
  expandedClassName?: unknown;
  isExpanded?: unknown;
};
type BuildSbtListSessionUniversePanelClassNameArgs = {
  baseClassName?: unknown;
  closedClassName?: unknown;
  isClosed?: unknown;
};
type SbtListClosestTarget = EventTarget & {
  closest: (selector: string) => Element | null;
};

const hasSbtListClosestTarget = (value: unknown): value is SbtListClosestTarget =>
  !!value && typeof value === 'object' && typeof (value as { closest?: unknown }).closest === 'function';

export const buildSbtListLoadingGroupStatusClassName = ({
  activeClassName = '',
  baseClassName = '',
  pendingClassName = '',
  scanInProgress = false,
}: BuildSbtListLoadingGroupStatusClassNameArgs = {}): string =>
  [String(baseClassName || ''), scanInProgress ? String(activeClassName || '') : String(pendingClassName || '')]
    .filter(Boolean)
    .join(' ');

export const buildSbtListLoadingProgressFillClassName = ({
  baseClassName = '',
  hasLatest = false,
  indeterminateClassName = '',
}: BuildSbtListLoadingProgressFillClassNameArgs = {}): string =>
  [String(baseClassName || ''), hasLatest ? '' : String(indeterminateClassName || '')].filter(Boolean).join(' ');

export const resolveSbtListLoadingProgressFillStyle = ({
  hasLatest = false,
  progressPct = 0,
}: ResolveSbtListLoadingProgressFillStyleArgs = {}): Record<string, string | undefined> => ({
  width: hasLatest ? `${Number(progressPct || 0)}%` : undefined,
});

export const resolveSbtListRelativeImageStyle = (): Record<string, string> => ({
  position: 'relative',
});

export const resolveSbtListHeaderSpinnerWrapStyle = (): Record<string, string> => ({
  alignItems: 'center',
  display: 'flex',
  gap: '6px',
});

export const resolveSbtListHeaderBlocksLeftStyle = (): Record<string, string | number> => ({
  fontSize: '0.85rem',
  opacity: 0.85,
});

export const buildSbtListExpandedCardShellClassName = ({
  baseClassName = '',
  expandedClassName = '',
  isExpanded = false,
}: BuildSbtListExpandedCardShellClassNameArgs = {}): string =>
  [String(baseClassName || ''), isExpanded ? String(expandedClassName || '') : ''].filter(Boolean).join(' ');

export const buildSbtListSessionUniversePanelClassName = ({
  baseClassName = '',
  closedClassName = '',
  isClosed = false,
}: BuildSbtListSessionUniversePanelClassNameArgs = {}): string =>
  [String(baseClassName || ''), isClosed ? String(closedClassName || '') : ''].filter(Boolean).join(' ');

export const findSbtListInteractiveAncestor = (
  target: EventTarget | null | undefined,
  selector: string,
): Element | null => (hasSbtListClosestTarget(target) ? target.closest(selector) : null);
