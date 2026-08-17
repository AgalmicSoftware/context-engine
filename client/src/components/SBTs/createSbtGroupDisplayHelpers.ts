export type BuildCreateSbtCollapseTogglePatchArgs = {
  section?: unknown;
  state?: unknown;
};

export type ResolveCreateSbtCollapseHeaderDisplayStateArgs = {
  isCollapsed?: unknown;
  title?: unknown;
};

export type BuildCreateSbtCollapseHeaderClassNameArgs = {
  baseClassName?: unknown;
  openClassName?: unknown;
  shouldUseOpenClass?: unknown;
};

export type BuildCreateSbtActiveClassNameArgs = {
  activeClassName?: unknown;
  baseClassNames?: unknown;
  shouldUseActiveClass?: unknown;
};

export type BuildCreateSbtActionLinkClassNameArgs = {
  actionClassName?: unknown;
  linkClassName?: unknown;
};

export type BuildCreateSbtInlineFieldLockClassNameArgs = {
  baseClassName?: unknown;
  inlineClassName?: unknown;
};

export type BuildCreateSbtTokenInfoMetaCardClassNameArgs = {
  fieldSectionClassName?: unknown;
  metaCardClassName?: unknown;
};

export type CreateSbtHiddenQrDisplayState = {
  hiddenStyle: Record<string, string | number>;
};

export type CreateSbtCollapseHeaderDisplayState = {
  ariaExpanded: boolean;
  ariaLabel: string;
  shouldRenderCollapsedTitle: boolean;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
  shouldUseOpenClass: boolean;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildCreateSbtCollapseTogglePatch = ({
  section = '',
  state = {},
}: BuildCreateSbtCollapseTogglePatchArgs = {}): Record<string, boolean> => {
  const sectionKey = String(section || '');
  const source = isPlainObject(state) ? state : {};
  return {
    [sectionKey]: !source[sectionKey],
  };
};

export const resolveCreateSbtCollapseHeaderDisplayState = ({
  isCollapsed = false,
  title = '',
}: ResolveCreateSbtCollapseHeaderDisplayStateArgs = {}): CreateSbtCollapseHeaderDisplayState => {
  const collapsed = !!isCollapsed;
  const normalizedTitle = String(title || '');
  return {
    ariaExpanded: !collapsed,
    ariaLabel: `${collapsed ? 'Expand' : 'Collapse'} ${normalizedTitle}`,
    shouldRenderCollapsedTitle: collapsed,
    shouldRenderClosedIcon: collapsed,
    shouldRenderOpenIcon: !collapsed,
    shouldUseOpenClass: !collapsed,
  };
};

export const buildCreateSbtCollapseHeaderClassName = ({
  baseClassName = '',
  openClassName = '',
  shouldUseOpenClass = false,
}: BuildCreateSbtCollapseHeaderClassNameArgs = {}): string =>
  [String(baseClassName || ''), shouldUseOpenClass ? String(openClassName || '') : ''].filter(Boolean).join(' ');

export const buildCreateSbtActiveClassName = ({
  activeClassName = '',
  baseClassNames = [],
  shouldUseActiveClass = false,
}: BuildCreateSbtActiveClassNameArgs = {}): string => {
  const baseNames = Array.isArray(baseClassNames) ? baseClassNames : [baseClassNames];
  return [
    ...baseNames.map((className) => String(className || '')),
    shouldUseActiveClass ? String(activeClassName || '') : '',
  ]
    .filter(Boolean)
    .join(' ');
};

export const resolveCreateSbtTooltipIconStyle = (): Record<string, number> => ({
  opacity: 0.5,
});

export const resolveCreateSbtActionIconStyle = (): Record<string, string> => ({
  marginRight: '5px',
});

export const resolveCreateSbtFailureIconStyle = (): Record<string, string> => ({
  color: 'var(--ce-status-danger-text)',
});

export const resolveCreateSbtShareableTooltipIconStyle = (): Record<string, string | number> => ({
  opacity: 0.5,
  marginLeft: '8px',
  fontSize: '0.8em',
});

export const buildCreateSbtActionLinkClassName = ({
  actionClassName = '',
  linkClassName = '',
}: BuildCreateSbtActionLinkClassNameArgs = {}): string =>
  [String(actionClassName || ''), String(linkClassName || '')].filter(Boolean).join(' ');

export const buildCreateSbtInlineFieldLockClassName = ({
  baseClassName = '',
  inlineClassName = '',
}: BuildCreateSbtInlineFieldLockClassNameArgs = {}): string =>
  [String(baseClassName || ''), String(inlineClassName || '')].filter(Boolean).join(' ');

export const buildCreateSbtTokenInfoMetaCardClassName = ({
  fieldSectionClassName = '',
  metaCardClassName = '',
}: BuildCreateSbtTokenInfoMetaCardClassNameArgs = {}): string =>
  [String(fieldSectionClassName || ''), String(metaCardClassName || '')].filter(Boolean).join(' ');

export const resolveCreateSbtHiddenQrDisplayState = (): CreateSbtHiddenQrDisplayState => ({
  hiddenStyle: {
    position: 'absolute',
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  },
});
