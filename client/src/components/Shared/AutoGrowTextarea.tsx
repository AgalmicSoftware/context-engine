import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { Input, type InputProps } from 'reactstrap';
import { subscribeThemeChanges } from '../../utilities/ui/themeRuntime';

type AutoGrowTextareaProps = Omit<InputProps, 'type'> & {
  // For one-line values such as answer options: Enter and pasted line breaks add no new line.
  singleLine?: boolean;
};

const fitToContent = (area: HTMLTextAreaElement) => {
  const computed = window.getComputedStyle(area);
  // scrollHeight leaves out the borders that a border-box height includes.
  const borders =
    computed.boxSizing === 'border-box'
      ? (Number.parseFloat(computed.borderTopWidth) || 0) + (Number.parseFloat(computed.borderBottomWidth) || 0)
      : 0;
  area.style.height = 'auto';
  area.style.height = `${Math.ceil(area.scrollHeight + borders)}px`;
};

// A textarea as tall as its text, so a long question or option is read in full on a narrow screen.
export default function AutoGrowTextarea({
  innerRef,
  singleLine = false,
  onChange,
  onKeyDown,
  rows = 1,
  style,
  value,
  ...props
}: AutoGrowTextareaProps) {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const setRef = useCallback(
    (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      areaRef.current = element as HTMLTextAreaElement | null;
      if (typeof innerRef === 'function') innerRef(element);
      else if (innerRef) (innerRef as React.MutableRefObject<typeof element>).current = element;
    },
    [innerRef],
  );

  useLayoutEffect(() => {
    if (areaRef.current) fitToContent(areaRef.current);
  }, [value]);

  // A new width, web fonts that finish loading and another theme each rewrap the text. Subscribing
  // during layout, straight after the first fit, leaves no gap for a font load to finish unseen.
  // Each refit waits a frame: resizing inside the observer's callback raises its loop error.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return undefined;
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitToContent(area));
    };
    let width = area.clientWidth;
    const onResize = () => {
      if (area.clientWidth === width) return;
      width = area.clientWidth;
      refit();
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onResize);
    observer?.observe(area);
    const fonts = document.fonts;
    fonts?.addEventListener('loadingdone', refit);
    const unsubscribeTheme = subscribeThemeChanges(refit);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      fonts?.removeEventListener('loadingdone', refit);
      unsubscribeTheme();
    };
  }, []);

  return (
    <Input
      {...props}
      type="textarea"
      rows={rows}
      value={value}
      innerRef={setRef}
      style={{ overflowY: 'hidden', resize: 'none', ...style }}
      onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
        if (singleLine && event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
        onKeyDown?.(event);
      }}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        if (singleLine && /[\r\n]/.test(event.target.value)) {
          event.target.value = event.target.value.replace(/\s*[\r\n]+\s*/g, ' ');
        }
        onChange?.(event);
      }}
    />
  );
}
