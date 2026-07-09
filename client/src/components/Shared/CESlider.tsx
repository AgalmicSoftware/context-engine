import React from 'react';

type SliderNumberLike = number | string | null | undefined;

type CESliderProps = {
  min?: SliderNumberLike;
  max?: SliderNumberLike;
  step?: SliderNumberLike;
  value?: SliderNumberLike;
  disabled?: boolean;
  tooltip?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onChange?: (value: number, event: Event) => void;
  onChangeStart?: () => void;
  onChangeComplete?: (value: number) => void;
};

const joinClassNames = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

const toFiniteNumber = (value: SliderNumberLike, fallback: number) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const ARROW_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

const getKeyboardValue = ({
  key,
  value,
  min,
  max,
  step,
}: {
  key: string;
  value: number;
  min: number;
  max: number;
  step: number;
}) => {
  if (key === 'ArrowRight' || key === 'ArrowUp') {
    return Math.min(value + step, max);
  }
  if (key === 'ArrowLeft' || key === 'ArrowDown') {
    return Math.max(value - step, min);
  }
  return value;
};

function CESlider({
  min = 0,
  max = 10,
  step = 1,
  value,
  disabled = false,
  tooltip = false,
  className,
  style,
  onChange,
  onChangeStart,
  onChangeComplete,
}: CESliderProps) {
  const resolvedMin = toFiniteNumber(min, 0);
  const resolvedMax = toFiniteNumber(max, 10);
  const resolvedStep = toFiniteNumber(step, 1);
  const tooltipEnabled = Boolean(tooltip);
  const resolvedValue = clampValue(toFiniteNumber(value, resolvedMin), resolvedMin, resolvedMax);
  const rangeSpan = resolvedMax - resolvedMin;
  const percentage = rangeSpan <= 0 ? 0 : ((resolvedValue - resolvedMin) / rangeSpan) * 100;

  const handleInteractionStart = React.useCallback(() => {
    if (disabled || typeof onChangeStart !== 'function') return;
    onChangeStart();
  }, [disabled, onChangeStart]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled || typeof onChange !== 'function') return;
      onChange(Number(event.target.value), event.nativeEvent);
    },
    [disabled, onChange],
  );

  const handleInteractionEnd = React.useCallback(
    (event: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
      if (disabled || typeof onChangeComplete !== 'function') return;
      onChangeComplete(Number(event.currentTarget.value));
    },
    [disabled, onChangeComplete],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      const isArrowKey = ARROW_KEYS.includes(event.key);
      if (!isArrowKey) return;

      const nextValue = getKeyboardValue({
        key: event.key,
        value: resolvedValue,
        min: resolvedMin,
        max: resolvedMax,
        step: resolvedStep,
      });

      event.preventDefault();
      if (nextValue === resolvedValue) return;

      if (typeof onChange === 'function') {
        onChange(nextValue, event.nativeEvent);
      }
      if (typeof onChangeComplete === 'function') {
        onChangeComplete(nextValue);
      }
    },
    [disabled, onChange, onChangeComplete, resolvedMax, resolvedMin, resolvedStep, resolvedValue],
  );

  return (
    <div
      className={joinClassNames('rangeslider', 'rangeslider-horizontal', className, tooltipEnabled && null)}
      style={style}
    >
      <div className="rangeslider__fill" style={{ width: `${percentage}%` }} />
      <div className="rangeslider__handle" style={{ left: `${percentage}%` }} />
      <input
        type="range"
        min={resolvedMin}
        max={resolvedMax}
        step={resolvedStep}
        value={resolvedValue}
        disabled={disabled}
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
        onChange={handleChange}
        onMouseUp={handleInteractionEnd}
        onTouchEnd={handleInteractionEnd}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          top: '-15px',
          left: '-15px',
          width: 'calc(100% + 30px)',
          height: 'calc(100% + 30px)',
          margin: 0,
          opacity: 0,
          cursor: disabled ? 'default' : 'pointer',
          pointerEvents: disabled ? 'none' : 'auto',
          zIndex: 10,
        }}
      />
    </div>
  );
}

export default CESlider;
