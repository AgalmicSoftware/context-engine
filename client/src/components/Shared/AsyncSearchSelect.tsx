import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import styles from './AsyncSearchSelect.module.scss';

type AsyncSearchOption = Record<string, unknown> & {
  value?: unknown;
  label?: React.ReactNode;
};

type AsyncSearchSelectProps = {
  id?: string;
  options?: AsyncSearchOption[] | null;
  value?: AsyncSearchOption | null;
  onChange?: (option: AsyncSearchOption) => void;
  placeholder?: string;
  isLoading?: boolean;
  loadingMessage?: () => React.ReactNode;
  noOptionsMessage?: () => React.ReactNode;
  formatOptionLabel?: (option: AsyncSearchOption) => React.ReactNode;
  formatValueLabel?: (option: AsyncSearchOption) => React.ReactNode;
  getOptionValue?: (option: AsyncSearchOption | null | undefined) => unknown;
  filterOption?: (option: AsyncSearchOption, query: string) => boolean;
  classNamePrefix?: string;
  variant?: string;
  className?: string;
  disabled?: boolean;
  inputId?: string;
};

const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');

const focusElement = (node: Element | null) => {
  if (node instanceof HTMLElement) node.focus();
};

const getFallbackLabel = (option: AsyncSearchOption | null | undefined) =>
  option?.label ?? (option?.value == null ? '' : String(option.value));

const AsyncSearchSelect = ({
  id,
  options = [],
  value = null,
  onChange,
  placeholder = '',
  isLoading = false,
  loadingMessage,
  noOptionsMessage,
  formatOptionLabel,
  formatValueLabel,
  getOptionValue,
  filterOption,
  classNamePrefix,
  variant = 'default',
  className = '',
  disabled = false,
  inputId,
}: AsyncSearchSelectProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId();
  const resolvedInputId = inputId || id || 'ce-async-select-' + generatedId;
  const controlLabelId = resolvedInputId + '-label';
  const normalizedOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const hasValue = value !== null && value !== undefined;
  const optionKeyFor = useCallback(
    (option: AsyncSearchOption | null | undefined) => {
      if (option === null || option === undefined) return '';
      return String((typeof getOptionValue === 'function' ? getOptionValue(option) : option?.value) ?? '');
    },
    [getOptionValue],
  );
  const renderOptionLabel = useCallback(
    (option: AsyncSearchOption) =>
      typeof formatOptionLabel === 'function' ? formatOptionLabel(option) : getFallbackLabel(option),
    [formatOptionLabel],
  );
  const renderValueLabel = useCallback(
    (option: AsyncSearchOption) =>
      typeof formatValueLabel === 'function' ? formatValueLabel(option) : renderOptionLabel(option),
    [formatValueLabel, renderOptionLabel],
  );
  const selectedKey = useMemo(() => optionKeyFor(value), [optionKeyFor, value]);
  const filteredOptions = useMemo(() => {
    const trimmed = String(query || '')
      .trim()
      .toLowerCase();
    return trimmed
      ? normalizedOptions.filter((option) => {
          if (typeof filterOption === 'function') {
            return filterOption(option, trimmed);
          }
          const haystack = [
            option?.label,
            option?.value,
            typeof getOptionValue === 'function' ? getOptionValue(option) : null,
          ]
            .filter((valuePart) => valuePart !== null && valuePart !== undefined)
            .join(' ')
            .toLowerCase();
          return haystack.includes(trimmed);
        })
      : normalizedOptions;
  }, [filterOption, getOptionValue, normalizedOptions, query]);
  const hasVisibleOptions = filteredOptions.length > 0;
  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
    setFocusedIndex(-1);
  }, []);
  const handleWrapperBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      if (!open || !wrapperRef.current) return;
      const nextFocused = event.relatedTarget;
      if (nextFocused instanceof Node && wrapperRef.current.contains(nextFocused)) return;
      requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (activeElement && wrapperRef.current?.contains(activeElement)) return;
        closeMenu();
      });
    },
    [closeMenu, open],
  );
  const focusOptionAt = useCallback((index: number) => {
    setFocusedIndex(index);
    const row = listRef.current?.querySelector(`[data-ce-async-select-index="${index}"]`);
    focusElement(row ?? null);
  }, []);
  useEffect(() => {
    if (disabled && open) closeMenu();
  }, [closeMenu, disabled, open]);
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) =>
      wrapperRef.current && event.target instanceof Node && !wrapperRef.current.contains(event.target) && closeMenu();
    const handleFocusIn = (event: FocusEvent) =>
      wrapperRef.current && event.target instanceof Node && !wrapperRef.current.contains(event.target) && closeMenu();
    const handleKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && closeMenu();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, open]);
  useEffect(() => {
    if (!open) return;
    if (searchRef.current && typeof searchRef.current.focus === 'function') searchRef.current.focus();
    setFocusedIndex(-1);
  }, [open]);
  const handleControlClick = useCallback(() => {
    if (disabled) return;
    if (open) {
      closeMenu();
      return;
    }
    setOpen(true);
  }, [closeMenu, disabled, open]);
  const handleSelect = useCallback(
    (option: AsyncSearchOption) => {
      if (disabled || !onChange) return;
      onChange(option);
      closeMenu();
    },
    [closeMenu, disabled, onChange],
  );
  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown' && hasVisibleOptions) {
        event.preventDefault();
        focusOptionAt(0);
        return;
      }
      if (event.key === 'Tab') closeMenu();
    },
    [closeMenu, focusOptionAt, hasVisibleOptions],
  );
  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, option: AsyncSearchOption, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleSelect(option);
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        focusOptionAt(Math.min(filteredOptions.length - 1, index + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (index <= 0) {
          setFocusedIndex(-1);
          if (searchRef.current && typeof searchRef.current.focus === 'function') searchRef.current.focus();
          return;
        }
        focusOptionAt(index - 1);
        return;
      }
      if (event.key === 'Tab') closeMenu();
    },
    [closeMenu, filteredOptions.length, focusOptionAt, handleSelect],
  );
  const emptyContent = typeof noOptionsMessage === 'function' ? noOptionsMessage() : 'No options';
  return (
    <div
      ref={wrapperRef}
      onBlurCapture={handleWrapperBlur}
      className={cx(styles.wrapper, className, classNamePrefix && `${classNamePrefix}__container`)}
      data-ce-async-select-open={open ? 'true' : 'false'}
      data-ce-async-select-variant={variant}
    >
      <button
        type="button"
        className={cx(styles.control, classNamePrefix && `${classNamePrefix}__control`)}
        onClick={handleControlClick}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={controlLabelId}
        disabled={disabled}
      >
        <div
          id={controlLabelId}
          className={styles.controlLabel}
          style={{
            color: hasValue ? 'var(--ce-async-select-text-color)' : 'var(--ce-async-select-placeholder-color)',
          }}
        >
          {hasValue ? renderValueLabel(value) : placeholder}
        </div>
        {isLoading ? (
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            className={styles.controlSpinner}
            data-testid="ce-async-select-control-spinner"
            aria-hidden="true"
          />
        ) : null}
        <span className={styles.caret} aria-hidden="true" />
      </button>
      {open && (
        <div className={cx(styles.menu, classNamePrefix && `${classNamePrefix}__menu`)}>
          <div className={styles.searchRow}>
            <input
              ref={searchRef}
              id={resolvedInputId}
              data-testid={resolvedInputId}
              className={styles.search}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              aria-label="Search options"
              placeholder="Search..."
              autoComplete="off"
              autoFocus
              disabled={disabled}
            />
          </div>
          {!isLoading && !hasVisibleOptions && emptyContent !== null && emptyContent !== undefined ? (
            <div className={styles.empty} data-testid="ce-async-select-empty" role="status" aria-live="polite">
              {emptyContent}
            </div>
          ) : null}
          <div className={styles.list} ref={listRef} role="listbox" aria-label={placeholder || 'Options'}>
            {hasVisibleOptions
              ? filteredOptions.map((option, index) => {
                  const optionKey = optionKeyFor(option);
                  const isSelected = hasValue && optionKey !== '' && optionKey === selectedKey;
                  const isFocused = focusedIndex === index;
                  return (
                    <div
                      key={optionKey || index}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      data-ce-async-select-index={index}
                      className={cx(
                        styles.option,
                        isFocused && styles.optionFocused,
                        isSelected && styles.optionSelected,
                        classNamePrefix && `${classNamePrefix}__option`,
                        classNamePrefix && isFocused && `${classNamePrefix}__option--is-focused`,
                        classNamePrefix && isSelected && `${classNamePrefix}__option--is-selected`,
                      )}
                      onClick={() => handleSelect(option)}
                      onKeyDown={(event) => handleRowKeyDown(event, option, index)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      {renderOptionLabel(option)}
                    </div>
                  );
                })
              : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AsyncSearchSelect;
