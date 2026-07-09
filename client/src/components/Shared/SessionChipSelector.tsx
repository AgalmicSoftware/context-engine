import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
import styles from './SessionChipSelector.module.scss';

type CSSVariableStyle = React.CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

type SessionChipOption = {
  key?: React.Key;
  slug?: string | null;
  label: string;
  ariaLabel?: string;
  selected?: boolean;
  active?: boolean;
  loaded?: boolean;
  general?: boolean;
  primary?: boolean;
  disabled?: boolean;
  href?: string;
  showOpen?: boolean;
  metaText?: string;
  progressText?: string;
  showProgress?: boolean;
  indeterminate?: boolean;
  style?: CSSVariableStyle;
  rowTestId?: string;
  chipTestId?: string;
  checkTestId?: string;
  openTestId?: string;
  openTitle?: string;
  progressWrapTestId?: string;
  progressTrackTestId?: string;
  progressFillTestId?: string;
  progressTextTestId?: string;
  onToggle?: (slug: string, option: SessionChipOption) => void;
  onOpen?: (slug: string, option: SessionChipOption, event: React.MouseEvent<HTMLSpanElement>) => void;
};

type SessionChipSelectorProps = {
  options?: SessionChipOption[] | null;
  onToggle?: (slug: string, option: SessionChipOption) => void;
  onOpen?: (slug: string, option: SessionChipOption, event: React.MouseEvent<HTMLSpanElement>) => void;
  emptyText?: string;
  className?: string;
  collapsedLimit?: number;
  expandLabel?: string;
  collapseLabel?: string;
  expandToggleTestId?: string;
};

const normalizeSlug = (slug?: string | null) => String(slug || '').trim();

const SessionChipSelector = ({
  options = [],
  onToggle,
  onOpen,
  emptyText = 'No sessions available.',
  className = '',
  collapsedLimit = 0,
  expandLabel = 'See more',
  collapseLabel = 'Show less',
  expandToggleTestId = '',
}: SessionChipSelectorProps) => {
  const list = Array.isArray(options) ? options : [];
  const normalizedCollapsedLimit = Number.isFinite(Number(collapsedLimit))
    ? Math.max(0, Math.floor(Number(collapsedLimit)))
    : 0;
  const canCollapse = normalizedCollapsedLimit > 0 && list.length > normalizedCollapsedLimit;
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!canCollapse && expanded) {
      setExpanded(false);
    }
  }, [canCollapse, expanded]);

  if (list.length === 0) {
    return <div className={styles.emptyState}>{emptyText}</div>;
  }

  const visibleList = canCollapse && !expanded ? list.slice(0, normalizedCollapsedLimit) : list;
  const hiddenCount = canCollapse ? Math.max(0, list.length - normalizedCollapsedLimit) : 0;

  return (
    <div className={[styles.selector, className].filter(Boolean).join(' ')}>
      {visibleList.map((option) => {
        const slug = normalizeSlug(option.slug);
        const chipClasses = [
          styles.chip,
          option.selected ? styles.chipSelected : '',
          option.active ? styles.chipActive : '',
          option.loaded ? styles.chipLoaded : '',
          option.loaded === false ? styles.chipUnloaded : '',
          option.general ? styles.chipGeneral : '',
          option.disabled ? styles.chipDisabled : '',
        ]
          .filter(Boolean)
          .join(' ');

        const handleChipClick = () => {
          if (option.disabled) return;
          if (typeof option.onToggle === 'function') {
            option.onToggle(slug, option);
            return;
          }
          if (typeof onToggle === 'function') onToggle(slug, option);
        };

        const handleOpenClick = (event: React.MouseEvent<HTMLSpanElement>) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof option.onOpen === 'function') {
            option.onOpen(slug, option, event);
            return;
          }
          if (typeof onOpen === 'function') onOpen(slug, option, event);
        };

        return (
          <div key={option.key || slug || option.label} className={styles.chipRow} data-testid={option.rowTestId}>
            <button
              type="button"
              className={chipClasses}
              data-testid={option.chipTestId}
              data-session-selected={option.selected ? 'true' : 'false'}
              data-session-loaded={option.loaded ? 'true' : 'false'}
              aria-label={option.ariaLabel || option.label}
              aria-pressed={option.selected}
              disabled={option.disabled}
              style={option.style}
              onClick={handleChipClick}
            >
              <span className={styles.chipTopRow}>
                <span className={styles.chipContent}>
                  {option.selected && (
                    <span aria-hidden="true" className={styles.chipCheck} data-testid={option.checkTestId}>
                      ✓
                    </span>
                  )}
                  <span>{option.label}</span>
                </span>

                {option.primary ? <span className={styles.primaryBadge}>Primary</span> : null}

                {(option.href || option.showOpen) && (
                  <span
                    className={styles.externalLink}
                    data-testid={option.openTestId}
                    aria-hidden="true"
                    title={option.openTitle || `Open session ${option.label}`}
                    data-featured-card-ignore-nav="true"
                    onClick={handleOpenClick}
                  >
                    <FontAwesomeIcon icon={faExternalLinkAlt} className={styles.externalIcon} />
                  </span>
                )}
              </span>

              {option.metaText ? <span className={styles.metaText}>{option.metaText}</span> : null}

              {option.showProgress && (
                <span className={styles.progressWrap} aria-hidden="true" data-testid={option.progressWrapTestId}>
                  <span className={styles.progressTrack} data-testid={option.progressTrackTestId}>
                    <span
                      className={[styles.progressFill, option.indeterminate ? styles.progressFillIndeterminate : '']
                        .filter(Boolean)
                        .join(' ')}
                      data-testid={option.progressFillTestId}
                    />
                  </span>
                  <span className={styles.progressText} data-testid={option.progressTextTestId}>
                    {option.progressText}
                  </span>
                </span>
              )}
            </button>
          </div>
        );
      })}
      {canCollapse ? (
        <button
          type="button"
          className={styles.expandToggle}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          data-testid={expandToggleTestId || undefined}
        >
          {expanded ? collapseLabel : `${expandLabel}${hiddenCount > 0 ? ` (${hiddenCount} more)` : ''}`}
        </button>
      ) : null}
    </div>
  );
};

export default SessionChipSelector;
