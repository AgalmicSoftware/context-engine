import React, { useEffect, useMemo, useRef, useState } from 'react';

type CEDateTimeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'min' | 'onChange' | 'step' | 'type' | 'value'
> & {
  selected?: Date | null;
  onChange?: (value: Date | null) => void;
  minDate?: Date | null;
  isClearable?: boolean;
  showTimeSelect?: boolean;
  timeIntervals?: number | string;
  placeholderText?: string;
  calendarClassName?: string;
  timeFormat?: string;
  timeCaption?: string;
  dateFormat?: string;
};

const padNumber = (value: number) => String(value).padStart(2, '0');

const toLocalInputValue = (value: Date | null | undefined, withTime = false) => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    return '';
  }
  const year = value.getFullYear();
  const month = padNumber(value.getMonth() + 1);
  const day = padNumber(value.getDate());
  if (!withTime) {
    return `${year}-${month}-${day}`;
  }
  const hours = padNumber(value.getHours());
  const minutes = padNumber(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const normalizeDateValue = (rawValue: string, withTime = false) => {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  const normalized = withTime ? value : `${value}T00:00`;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const joinClassNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const normalizeTimeStepSeconds = (showTimeSelect: boolean, timeIntervals: number | string) =>
  showTimeSelect ? Math.max(1, Number(timeIntervals || 15)) * 60 : undefined;

const alignMinDateToStepBoundary = (value: Date | null | undefined, stepSeconds?: number) => {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    return value;
  }
  const stepMinutes = Number(stepSeconds || 0) / 60;
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    return value;
  }

  const aligned = new Date(value.getTime());
  const totalMinutes =
    aligned.getHours() * 60 + aligned.getMinutes() + (aligned.getSeconds() * 1000 + aligned.getMilliseconds()) / 60000;
  const roundedMinutes = Math.ceil(totalMinutes / stepMinutes) * stepMinutes;

  aligned.setHours(0, 0, 0, 0);
  aligned.setMinutes(roundedMinutes, 0, 0);
  return aligned;
};

const CEDateTimeInput = ({
  selected = null,
  onChange,
  minDate = null,
  isClearable = false,
  showTimeSelect = false,
  timeIntervals = 15,
  placeholderText = '',
  className = '',
  calendarClassName = '',
  timeFormat,
  timeCaption,
  dateFormat,
  ...rest
}: CEDateTimeInputProps) => {
  void timeFormat;
  void timeCaption;
  void dateFormat;
  const inputType = showTimeSelect ? 'datetime-local' : 'date';
  const selectedInputValue = toLocalInputValue(selected, showTimeSelect);
  const [draftValue, setDraftValue] = useState(() => selectedInputValue);
  const preserveDraftOnNextSelectedSyncRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const step = normalizeTimeStepSeconds(showTimeSelect, timeIntervals);
  const normalizedMinDate = useMemo(
    () => (showTimeSelect ? alignMinDateToStepBoundary(minDate, step) : minDate),
    [minDate, showTimeSelect, step],
  );
  const minValue = toLocalInputValue(normalizedMinDate, showTimeSelect);
  const hasInvalidDraft = Boolean(String(draftValue || '').trim()) && !normalizeDateValue(draftValue, showTimeSelect);

  useEffect(() => {
    // When we clear the parent value for an invalid in-progress edit, keep the visible
    // draft so the user can finish typing instead of snapping the field back to empty.
    if (preserveDraftOnNextSelectedSyncRef.current && !selectedInputValue) {
      preserveDraftOnNextSelectedSyncRef.current = false;
      return;
    }
    preserveDraftOnNextSelectedSyncRef.current = false;
    setDraftValue(selectedInputValue);
  }, [selectedInputValue]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || typeof input.setCustomValidity !== 'function') return;
    input.setCustomValidity(
      hasInvalidDraft ? (showTimeSelect ? 'Enter a complete date and time.' : 'Enter a complete date.') : '',
    );
  }, [hasInvalidDraft, showTimeSelect]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        {...rest}
        aria-invalid={hasInvalidDraft || undefined}
        className={joinClassNames(className, calendarClassName)}
        min={minValue || undefined}
        onBlur={(event) => {
          if (hasInvalidDraft) {
            preserveDraftOnNextSelectedSyncRef.current = false;
            setDraftValue('');
            onChange?.(null);
          }
          if (typeof rest.onBlur === 'function') {
            rest.onBlur(event);
          }
        }}
        onChange={(event) => {
          const nextDraftValue = String(event.target.value || '');
          setDraftValue(nextDraftValue);

          if (!nextDraftValue.trim()) {
            preserveDraftOnNextSelectedSyncRef.current = false;
            onChange?.(null);
            return;
          }

          const normalizedValue = normalizeDateValue(nextDraftValue, showTimeSelect);
          if (normalizedValue) {
            preserveDraftOnNextSelectedSyncRef.current = false;
            onChange?.(normalizedValue);
            return;
          }

          preserveDraftOnNextSelectedSyncRef.current = true;
          onChange?.(null);
        }}
        placeholder={placeholderText}
        ref={inputRef}
        step={step}
        type={inputType}
        value={draftValue}
      />
      {isClearable && draftValue ? (
        <button
          aria-label="Clear date and time"
          onClick={() => {
            preserveDraftOnNextSelectedSyncRef.current = false;
            setDraftValue('');
            onChange?.(null);
          }}
          type="button"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
};

export default CEDateTimeInput;
