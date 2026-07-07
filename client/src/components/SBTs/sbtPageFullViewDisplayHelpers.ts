import { getSbtDescriptionText, getSbtDisplayName, isSbtFieldLocked } from '../../utilities/sbt/sbtDisplayNames.js';
import { getDisplayImageRenderState, type SbtPageDisplayImageState } from './sbtPageMediaHelpers';

type ResolveSbtPageFullViewShellStateArgs = {
  error?: unknown;
  hasSbtAddress?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageIdentityPanelDisplayStateArgs = {
  defaultImage?: unknown;
  fallbackState?: {
    displayImageFallbackKey?: unknown;
    displayImageFallbackIndex?: unknown;
  };
  sbtInfo?: unknown;
  unnamedLabel?: unknown;
};
type ResolveSbtPageSectionToggleDisplayStateArgs = {
  open?: unknown;
};
type BuildSbtPageSectionHeaderClassNameArgs = {
  baseClassName?: unknown;
  roundedClassName?: unknown;
};
type ResolveSbtPageCopyIconStateArgs = {
  copied?: unknown;
  copiedAddress?: unknown;
  targetKey?: unknown;
};
type ResolveSbtPageBookmarkButtonDisplayStateArgs = {
  bookmarked?: unknown;
};
type SbtPageFullViewShellState = {
  shouldRenderContent: boolean;
  shouldRenderError: boolean;
  shouldRenderLoading: boolean;
  shouldRenderMissingAddress: boolean;
};
type SbtPageIdentityPanelDisplayState = {
  descriptionText: string;
  displayImageState: SbtPageDisplayImageState | null;
  imageAlt: string;
  imageUrl: string;
  nameText: string;
  showDescriptionLockIcon: boolean;
};
type SbtPageSectionToggleDisplayState = {
  isOpen: boolean;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
};
type SbtPageCopyIconState = {
  shouldRenderCopiedIcon: boolean;
  shouldRenderDefaultIcon: boolean;
};
type SbtPageBookmarkButtonDisplayState = {
  iconStyle: Record<string, string | undefined>;
};

export const resolveSbtPageFullViewShellState = ({
  error = '',
  hasSbtAddress = false,
  sbtInfo = null,
}: ResolveSbtPageFullViewShellStateArgs = {}): SbtPageFullViewShellState => {
  const hasInfo = !!sbtInfo;
  const hasError = !!error;
  const hasAddress = !!hasSbtAddress;
  return {
    shouldRenderContent: hasAddress && hasInfo,
    shouldRenderError: hasAddress && hasError && !hasInfo,
    shouldRenderLoading: hasAddress && !hasInfo && !hasError,
    shouldRenderMissingAddress: !hasAddress,
  };
};

export const resolveSbtPageIdentityPanelDisplayState = ({
  defaultImage = '',
  fallbackState = {},
  sbtInfo = null,
  unnamedLabel = '',
}: ResolveSbtPageIdentityPanelDisplayStateArgs = {}): SbtPageIdentityPanelDisplayState => {
  const fallbackImage = String(defaultImage || '');
  const displayImageState = sbtInfo
    ? getDisplayImageRenderState(sbtInfo as Record<string, unknown>, fallbackState, fallbackImage)
    : null;
  const nameText = getSbtDisplayName(sbtInfo) || String(unnamedLabel || '');
  const rawDescription = sbtInfo && typeof sbtInfo === 'object' ? (sbtInfo as Record<string, unknown>).description : '';

  return {
    descriptionText: getSbtDescriptionText(sbtInfo),
    displayImageState,
    imageAlt: nameText,
    imageUrl: displayImageState?.src || fallbackImage,
    nameText,
    showDescriptionLockIcon: isSbtFieldLocked(sbtInfo, 'description') && !String(rawDescription || '').trim(),
  };
};

export const resolveSbtPageSectionToggleDisplayState = ({
  open = false,
}: ResolveSbtPageSectionToggleDisplayStateArgs = {}): SbtPageSectionToggleDisplayState => {
  const isOpen = !!open;
  return {
    isOpen,
    shouldRenderClosedIcon: !isOpen,
    shouldRenderOpenIcon: isOpen,
  };
};

export const buildSbtPageSectionHeaderClassName = ({
  baseClassName = '',
  roundedClassName = '',
}: BuildSbtPageSectionHeaderClassNameArgs = {}): string =>
  [String(baseClassName || ''), String(roundedClassName || '')].filter(Boolean).join(' ');

export const resolveSbtPageBookmarkButtonDisplayState = ({
  bookmarked = false,
}: ResolveSbtPageBookmarkButtonDisplayStateArgs = {}): SbtPageBookmarkButtonDisplayState => ({
  iconStyle: { color: bookmarked ? '#FFD700' : undefined },
});

export const resolveSbtPageInteractiveCursorStyle = (): Record<string, string> => ({
  cursor: 'pointer',
});

export const resolveSbtPageQuestionIconStyle = (): Record<string, string | number> => ({
  marginLeft: '5px',
  color: '#00ff9d',
  cursor: 'pointer',
  opacity: 0.5,
});

export const resolveSbtPageItalicNoteStyle = (): Record<string, string> => ({
  fontStyle: 'italic',
});

export const resolveSbtPageCopyErrorButtonStyle = (): Record<string, string> => ({
  background: 'transparent',
  border: 'none',
  marginLeft: '8px',
  cursor: 'pointer',
});

export const resolveSbtPageMutedInfoIconStyle = (): Record<string, number> => ({
  opacity: 0.5,
});

export const resolveSbtPageInlineLockIconStyle = (): Record<string, string> => ({
  marginRight: '6px',
});

export const resolveSbtPageRefreshIndicatorStyle = (): Record<string, string | number> => ({
  marginLeft: '10px',
  fontSize: '0.8em',
  opacity: 0.7,
});

export const resolveSbtPageCopyIconState = ({
  copied = undefined,
  copiedAddress = '',
  targetKey = '',
}: ResolveSbtPageCopyIconStateArgs = {}): SbtPageCopyIconState => {
  const target = String(targetKey || '');
  const isCopied = typeof copied !== 'undefined' ? !!copied : !!target && String(copiedAddress || '') === target;
  return {
    shouldRenderCopiedIcon: isCopied,
    shouldRenderDefaultIcon: !isCopied,
  };
};
