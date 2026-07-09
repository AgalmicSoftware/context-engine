import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribeToToasts } from '../../utilities/ui/toastBus.js';

type ToastPosition = 'bottom-right';

type ToastPayload = {
  id: string;
  message: string;
  kind?: string;
  duration: number;
  icon?: React.ReactNode;
};

type CEToasterProps = {
  position?: ToastPosition;
  toastOptions?: {
    style?: React.CSSProperties;
  };
};

const POSITION_STYLES: Record<ToastPosition, React.CSSProperties> = Object.freeze({
  'bottom-right': {
    bottom: 16,
    right: 16,
    alignItems: 'flex-end',
  },
});

const KIND_ACCENTS: Record<string, string> = Object.freeze({
  success: '#2ecf98',
  error: '#ff7b7b',
  warn: '#ffbe5c',
  info: '#6ea8ff',
});

const KIND_ICONS: Record<string, React.ReactNode> = Object.freeze({
  success: 'OK',
  error: '!',
  warn: '!',
  info: 'i',
});

const buildViewportStyle = (position: ToastPosition): React.CSSProperties => ({
  position: 'fixed',
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  pointerEvents: 'none',
  width: 'min(420px, calc(100vw - 24px))',
  ...(POSITION_STYLES[position] || POSITION_STYLES['bottom-right']),
});

const buildToastStyle = (kind: string, baseStyle: React.CSSProperties = {}): React.CSSProperties => ({
  pointerEvents: 'auto',
  borderRadius: 12,
  padding: '12px 14px',
  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.28)',
  borderLeft: `4px solid ${KIND_ACCENTS[kind] || KIND_ACCENTS.info}`,
  fontSize: '0.95rem',
  lineHeight: 1.45,
  ...baseStyle,
});

const closeButtonStyle: React.CSSProperties = {
  appearance: 'none',
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '0.95rem',
  fontWeight: 700,
  lineHeight: 1,
  opacity: 0.85,
  padding: 0,
};

const DEFAULT_TOAST_STYLE: React.CSSProperties = Object.freeze({});

const CEToaster = ({ position = 'bottom-right', toastOptions = {} }: CEToasterProps) => {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const viewportStyle = useMemo(() => buildViewportStyle(position), [position]);
  const baseToastStyle = toastOptions?.style || DEFAULT_TOAST_STYLE;

  useEffect(() => {
    const timers = timersRef.current;
    const clearToastTimer = (id: string) => {
      const timer = timers.get(id);
      if (!timer) return;
      clearTimeout(timer);
      timers.delete(id);
    };

    const dismissToast = (id: string) => {
      clearToastTimer(id);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    };

    const unsubscribe = subscribeToToasts((payload: ToastPayload) => {
      setToasts((current) => [...current, payload]);
      if (payload.duration > 0) {
        const timer = setTimeout(() => dismissToast(payload.id), payload.duration);
        timers.set(payload.id, timer);
      }
    });

    return () => {
      unsubscribe();
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <div aria-live="polite" data-testid="ce-toast-host" style={viewportStyle}>
      {toasts.map((toast) => {
        const kind = String(toast.kind || 'info');
        const icon = toast.icon || KIND_ICONS[kind] || KIND_ICONS.info;
        return (
          <div
            key={toast.id}
            data-testid="ce-toast-item"
            role={kind === 'error' ? 'alert' : 'status'}
            style={buildToastStyle(kind, baseToastStyle)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  minWidth: 20,
                  fontWeight: 700,
                  opacity: 0.9,
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1 }}>{toast.message}</div>
              <button
                aria-label={`Dismiss notification: ${toast.message}`}
                onClick={() => {
                  const timer = timersRef.current.get(toast.id);
                  if (timer) {
                    clearTimeout(timer);
                    timersRef.current.delete(toast.id);
                  }
                  setToasts((current) => current.filter((entry) => entry.id !== toast.id));
                }}
                style={closeButtonStyle}
                type="button"
              >
                x
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CEToaster;
