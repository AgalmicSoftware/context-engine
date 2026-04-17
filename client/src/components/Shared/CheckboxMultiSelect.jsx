import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './CheckboxMultiSelect.module.scss';

const toOptionKey = (option) => (
  option && (option.value !== undefined && option.value !== null)
    ? String(option.value)
    : ''
);

const CheckboxMultiSelect = ({
  inputId,
  options = [],
  value = [],
  onChange,
  placeholder = '',
  isClearable = false,
  className = '',
  ariaLabel,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);

  const normalizedValue = Array.isArray(value) ? value : [];
  const selectedKeys = useMemo(() => {
    const keys = new Set();
    normalizedValue.forEach((option) => {
      const key = toOptionKey(option);
      if (key) keys.add(key);
    });
    return keys;
  }, [normalizedValue]);

  const normalizedOptions = Array.isArray(options) ? options : [];

  const filteredOptions = useMemo(() => {
    const trimmed = String(query || '').trim().toLowerCase();
    if (!trimmed) return normalizedOptions;
    return normalizedOptions.filter((option) => (
      String(option?.label ?? option?.value ?? '').toLowerCase().includes(trimmed)
    ));
  }, [normalizedOptions, query]);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = searchRef.current;
    if (node && typeof node.focus === 'function') {
      node.focus();
    }
    setFocusedIndex(-1);
  }, [open]);

  const toggleOption = useCallback((option) => {
    if (disabled || !onChange) return;
    const key = toOptionKey(option);
    if (!key) return;
    const already = selectedKeys.has(key);
    if (already) {
      const next = normalizedValue.filter((entry) => toOptionKey(entry) !== key);
      onChange(next);
    } else {
      onChange([...normalizedValue, option]);
    }
  }, [disabled, onChange, normalizedValue, selectedKeys]);

  const handleClearAll = useCallback((event) => {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (disabled || !onChange) return;
    onChange([]);
  }, [disabled, onChange]);

  const handleControlClick = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSearchKeyDown = useCallback((event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredOptions.length > 0) {
        setFocusedIndex(0);
        const list = listRef.current;
        if (list) {
          const firstRow = list.querySelector('[data-cms-row-index="0"]');
          if (firstRow && typeof firstRow.focus === 'function') firstRow.focus();
        }
      }
    }
  }, [filteredOptions.length]);

  const handleRowKeyDown = useCallback((event, option, index) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOption(option);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min(filteredOptions.length - 1, index + 1);
      setFocusedIndex(nextIndex);
      const list = listRef.current;
      if (list) {
        const nextRow = list.querySelector(`[data-cms-row-index="${nextIndex}"]`);
        if (nextRow && typeof nextRow.focus === 'function') nextRow.focus();
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0) {
        setFocusedIndex(-1);
        if (searchRef.current && typeof searchRef.current.focus === 'function') searchRef.current.focus();
        return;
      }
      const prevIndex = index - 1;
      setFocusedIndex(prevIndex);
      const list = listRef.current;
      if (list) {
        const prevRow = list.querySelector(`[data-cms-row-index="${prevIndex}"]`);
        if (prevRow && typeof prevRow.focus === 'function') prevRow.focus();
      }
    }
  }, [filteredOptions.length, toggleOption]);

  const canClear = !!isClearable && normalizedValue.length > 0 && !disabled;
  const controlLabel = placeholder;
  const controlId = inputId ? `${inputId}-control` : undefined;

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${className || ''}`.trim()}
      data-cms-open={open ? 'true' : 'false'}
    >
      <div className={styles.controlRow}>
        <button
          type="button"
          id={controlId}
          className={styles.control}
          onClick={handleControlClick}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={ariaLabel || placeholder || 'Select options'}
          disabled={disabled}
        >
          <span className={styles.controlLabel}>{controlLabel}</span>
          <span className={styles.caret} aria-hidden="true" />
        </button>
        {canClear && (
          <button
            type="button"
            className={styles.clear}
            onClick={handleClearAll}
            aria-label="Clear all"
            title="Clear all"
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className={styles.menu} role="group" aria-label={ariaLabel || placeholder || 'Options'}>
          <div className={styles.searchRow}>
            <input
              ref={searchRef}
              id={inputId}
              data-testid={inputId}
              className={styles.search}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              autoComplete="off"
              disabled={disabled}
            />
          </div>
          <div className={styles.list} ref={listRef}>
            {filteredOptions.length === 0 ? (
              <div className={styles.empty}>No matches</div>
            ) : (
              filteredOptions.map((option, index) => {
                const key = toOptionKey(option);
                const checked = selectedKeys.has(key);
                return (
                  <label
                    key={key || index}
                    data-cms-row-index={index}
                    className={`${styles.row} ${checked ? styles.rowChecked : ''} ${focusedIndex === index ? styles.rowFocused : ''}`.trim()}
                    tabIndex={0}
                    onKeyDown={(event) => handleRowKeyDown(event, option, index)}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleOption(option)}
                      tabIndex={-1}
                    />
                    <span className={styles.rowLabel}>{option?.label ?? option?.value}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckboxMultiSelect;
