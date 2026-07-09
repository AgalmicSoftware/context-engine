/** @file GateMultiSelectLock.tsx */
import React, { useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faExternalLinkAlt, faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons';
import styles from './GateMultiSelectLock.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { t } from '../../utilities/ui/terminology.js';

type GateOption = {
  id?: unknown;
  label?: unknown;
  displayLabel?: unknown;
  badgeLabel?: unknown;
  secondaryLabel?: unknown;
  color?: unknown;
  mode?: unknown;
  operator?: unknown;
  gateMode?: unknown;
  requireAll?: boolean;
  sbtAddresses?: unknown;
  sbtAddress?: unknown;
  sourceSessionSlug?: unknown;
  sessionSlug?: unknown;
};

export type GateMultiSelectLockProps = {
  gateOptions: GateOption[] | null | undefined;
  selectedGateIds: unknown[] | null | undefined;
  onChangeSelectedGateIds?: (gateIds: string[]) => void;
  open: boolean;
  onToggleOpen?: (open: boolean) => void;
  disabled?: boolean;
  showDots?: boolean;
};

const resolveGateSbtDisplayLabel = resolveSbtDisplayLabel as (args: { address: unknown; fallback?: string }) => string;

const normalizeId = (val: unknown) => toStr(val).trim();

const uniq = (arr: unknown[] | null | undefined) => {
  const out: string[] = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach((item) => {
    const value = normalizeId(item);
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push(value);
  });
  return out;
};

const shortAddr = (value: unknown) => {
  const text = normalizeId(value);
  return text.length > 12 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
};

const normalizeGateMode = (option: GateOption = {}) => {
  const raw = normalizeId(
    option?.mode || option?.operator || option?.gateMode || (option?.requireAll ? 'all' : ''),
  ).toLowerCase();
  if (option?.requireAll === true || raw === 'all' || raw === 'and') return 'all';
  return 'any';
};

const collectSbtAddresses = (option: GateOption = {}) =>
  uniq([...(Array.isArray(option?.sbtAddresses) ? option.sbtAddresses : []), option?.sbtAddress]);

const resolveSbtItems = (addresses: unknown[] = [], sessionSlug = '') =>
  (Array.isArray(addresses) ? addresses : []).map((address) => {
    const normalizedAddress = normalizeId(address);
    const short = shortAddr(address);
    const label =
      resolveGateSbtDisplayLabel({
        address: normalizedAddress,
        fallback: 'short',
      }) || short;
    return {
      address: normalizedAddress,
      label: label === short ? label : `${label} (${short})`,
      href: buildSbtDetailPath(normalizedAddress, sessionSlug),
    };
  });

const GateMultiSelectLock = ({
  gateOptions,
  selectedGateIds,
  onChangeSelectedGateIds,
  open,
  onToggleOpen,
  disabled,
  showDots = true,
}: GateMultiSelectLockProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const options = useMemo(() => (Array.isArray(gateOptions) ? gateOptions.filter(Boolean) : []), [gateOptions]);
  const optionIds = useMemo(() => options.map((opt) => normalizeId(opt?.id)).filter(Boolean), [options]);

  const selected = useMemo(() => {
    const raw = Array.isArray(selectedGateIds) ? selectedGateIds : [];
    const normalized = uniq(raw);
    return normalized.filter((id) => optionIds.includes(id));
  }, [selectedGateIds, optionIds]);

  const locked = selected.length > 0;
  const primaryColor = useMemo(() => {
    if (selected.length !== 1) return '';
    const gateId = selected[0];
    const match = options.find((opt) => normalizeId(opt?.id) === gateId);
    return normalizeId(match?.color);
  }, [selected, options]);

  useEffect(() => {
    if (!open) return () => {};
    const handle = (evt: MouseEvent | TouchEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (evt.target instanceof Node && el.contains(evt.target)) return;
      if (typeof onToggleOpen === 'function') onToggleOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [open, onToggleOpen]);

  const updateSelection = (nextSet: Set<string>) => {
    const next = optionIds.filter((id) => nextSet.has(id));
    if (typeof onChangeSelectedGateIds === 'function') onChangeSelectedGateIds(next);
  };

  const toggleGate = (gateId: unknown) => {
    const id = normalizeId(gateId);
    if (!id) return;
    const nextSet = new Set(selected);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    updateSelection(nextSet);
  };

  const handleLockClick = () => {
    if (disabled || options.length === 0) return;
    if (typeof onToggleOpen === 'function') onToggleOpen(!open);
  };

  const dots =
    showDots && selected.length > 1
      ? selected.slice(0, 4).map((gateId) => {
          const match = options.find((opt) => normalizeId(opt?.id) === gateId);
          const color = normalizeId(match?.color) || '#888';
          return (
            <span
              key={gateId}
              className={styles.dot}
              style={{ backgroundColor: color, borderColor: color }}
              aria-hidden="true"
            />
          );
        })
      : null;

  const extraDotCount = showDots && selected.length > 4 ? selected.length - 4 : 0;
  const canEditGateLock = options.length > 0 && !disabled;
  const lockButtonLabel = canEditGateLock
    ? locked
      ? `Edit locked ${t('gateLower')}`
      : `Choose ${t('gateLower')}`
    : locked
      ? `${t('gate')} unavailable`
      : `No ${t('gateLower')} available`;

  return (
    <div
      className={`${styles.container}${disabled ? ` ${styles.disabled}` : ''}`}
      ref={containerRef}
      data-testid={E2E_TESTIDS.GATE_LOCK}
    >
      {dots ? (
        <span className={styles.dots} aria-hidden="true">
          {dots}
          {extraDotCount > 0 ? <span className={styles.dotMore}>+{extraDotCount}</span> : null}
        </span>
      ) : null}

      <button
        type="button"
        className={`${styles.lockButton}${locked ? ` ${styles.locked}` : ''}${open ? ` ${styles.open}` : ''}`}
        onClick={handleLockClick}
        disabled={!!disabled}
        aria-label={lockButtonLabel}
        aria-expanded={canEditGateLock ? open : undefined}
        aria-haspopup={canEditGateLock ? 'dialog' : undefined}
        data-testid={E2E_TESTIDS.GATE_LOCK_BUTTON}
      >
        <FontAwesomeIcon
          icon={locked ? faLock : faLockOpen}
          style={primaryColor ? { color: primaryColor } : undefined}
        />
      </button>

      {options.length > 0 && open && !disabled ? (
        <div
          className={styles.popover}
          role="dialog"
          aria-label={`Select ${t('gatesLower')}`}
          data-testid={E2E_TESTIDS.GATE_LOCK_POPOVER}
        >
          {options.map((opt) => {
            const gateId = normalizeId(opt?.id);
            if (!gateId) return null;
            const label = toStr(opt?.displayLabel || opt?.badgeLabel || opt?.label || gateId);
            const color = normalizeId(opt?.color) || '#888';
            const checked = selected.includes(gateId);
            const sbtAddresses = collectSbtAddresses(opt);
            const sbtItems = resolveSbtItems(sbtAddresses, normalizeId(opt?.sourceSessionSlug || opt?.sessionSlug));
            const modeLabel =
              sbtAddresses.length > 0
                ? normalizeGateMode(opt) === 'all'
                  ? `All selected ${t('sbts')} required`
                  : `Any one selected ${t('sbt')} unlocks`
                : '';
            const secondaryLabel = toStr(opt?.secondaryLabel || '');
            return (
              <div
                key={gateId}
                className={`${styles.row}${checked ? ` ${styles.rowActive}` : ''}`}
                data-testid={E2E_TESTIDS.GATE_LOCK_ROW}
                data-ce-gate-id={gateId}
                aria-current={checked ? 'true' : undefined}
              >
                <label className={styles.rowMain}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={checked}
                    onChange={() => toggleGate(gateId)}
                  />
                  <span
                    className={`${styles.selectionMark}${checked ? ` ${styles.selectionMarkActive}` : ''}`}
                    aria-hidden="true"
                  >
                    {checked ? <FontAwesomeIcon icon={faCheck} /> : null}
                  </span>
                  <span
                    className={styles.dotLarge}
                    style={{ backgroundColor: color, borderColor: color }}
                    aria-hidden="true"
                  />
                  <span className={styles.rowCopy}>
                    <span className={styles.rowLabel}>{label}</span>
                    {secondaryLabel || modeLabel ? (
                      <span className={styles.rowMeta}>
                        {secondaryLabel}
                        {secondaryLabel && modeLabel ? ' - ' : ''}
                        {modeLabel}
                      </span>
                    ) : null}
                  </span>
                </label>
                {sbtItems.length > 0 ? (
                  <div className={styles.sbtList}>
                    {sbtItems.map((item) => (
                      <span key={item.address} className={styles.sbtItem}>
                        <span className={styles.sbtText}>{item.label}</span>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.sbtLink}
                          aria-label={`Open ${t('sbt')} ${item.label}`}
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <FontAwesomeIcon icon={faExternalLinkAlt} />
                        </a>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!options.length && <div className={styles.empty}>{`No ${t('gatesLower')} configured.`}</div>}
        </div>
      ) : null}
    </div>
  );
};

export default GateMultiSelectLock;
