import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './AsyncSearchSelect.module.scss';

const cx = (...names) => names.filter(Boolean).join(' ');

const getFallbackLabel = (option) => option?.label ?? option?.value ?? '';

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
  getOptionValue,
  classNamePrefix,
  variant = 'default',
  className = '',
  disabled = false,
  inputId,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const generatedId = useId();
  const resolvedInputId = inputId || id || 'ce-async-select-' + generatedId;
  const controlLabelId = resolvedInputId + '-label';
  const normalizedOptions = useMemo(() => (Array.isArray(options) ? options : []), [options]);
  const hasValue = value !== null && value !== undefined;
  const optionKeyFor = useCallback((option) => {
    if (option === null || option === undefined) return '';
    return String(
      (typeof getOptionValue === 'function' ? getOptionValue(option) : option?.value) ?? ''
    );
  }, [getOptionValue]);
  const renderOptionLabel = useCallback(
    (option) => (typeof formatOptionLabel === 'function' ? formatOptionLabel(option) : getFallbackLabel(option)),
    [formatOptionLabel]
  );
  const selectedKey = useMemo(() => optionKeyFor(value), [optionKeyFor, value]);
  const filteredOptions = useMemo(() => {
    const trimmed = String(query || '').trim().toLowerCase();
    return trimmed
      ? normalizedOptions.filter((option) => (
        String(option?.label ?? option?.value ?? '').toLowerCase().includes(trimmed)
      ))
      : normalizedOptions;
  }, [normalizedOptions, query]);
  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
    setFocusedIndex(-1);
  }, []);
  const focusOptionAt = useCallback((index) => {
    setFocusedIndex(index);
    const row = listRef.current?.querySelector(`[data-ce-async-select-index="${index}"]`);
    if (row && typeof row.focus === 'function') row.focus();
  }, []);
  useEffect(() => {
    if (disabled && open) closeMenu();
  }, [closeMenu, disabled, open]);
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => wrapperRef.current
      && !wrapperRef.current.contains(event.target)
      && closeMenu();
    const handleKeyDown = (event) => event.key === 'Escape' && closeMenu();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
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
  const handleSelect = useCallback((option) => {
    if (disabled || !onChange) return;
    onChange(option);
    closeMenu();
  }, [closeMenu, disabled, onChange]);
  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === 'ArrowDown' && !isLoading && filteredOptions.length > 0) {
      event.preventDefault();
      focusOptionAt(0);
    }
  }, [filteredOptions.length, focusOptionAt, isLoading]);
  const handleRowKeyDown = useCallback((event, option, index) => {
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
    }
  }, [filteredOptions.length, focusOptionAt, handleSelect]);
  const loadingContent = typeof loadingMessage === 'function' ? loadingMessage() : 'Loading…';
  const emptyContent = typeof noOptionsMessage === 'function' ? noOptionsMessage() : 'No options';
  return (
    <div
      ref={wrapperRef}
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
        <span
          id={controlLabelId}
          className={styles.controlLabel}
          style={{
            color: hasValue ? 'var(--ce-async-select-text-color)' : 'var(--ce-async-select-placeholder-color)',
          }}
        >
          {hasValue ? renderOptionLabel(value) : placeholder}
        </span>
        {isLoading ? (
          <span
            className={styles.controlSpinner}
            data-testid="ce-async-select-control-spinner"
            aria-hidden="true"
          />
        ) : null}
        <span className={styles.caret} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={cx(styles.menu, classNamePrefix && `${classNamePrefix}__menu`)}
        >
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
          {isLoading ? (
            <div
              className={styles.loading}
              data-testid="ce-async-select-loading"
              role="status"
              aria-live="polite"
            >
              {loadingContent}
            </div>
          ) : null}
          {!isLoading &&
          filteredOptions.length === 0 &&
          emptyContent !== null &&
          emptyContent !== undefined ? (
            <div
              className={styles.empty}
              data-testid="ce-async-select-empty"
              role="status"
              aria-live="polite"
            >
              {emptyContent}
            </div>
          ) : null}
          <div
            className={styles.list}
            ref={listRef}
            role="listbox"
            aria-label={placeholder || 'Options'}
          >
            {!isLoading && filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
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
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AsyncSearchSelect;
