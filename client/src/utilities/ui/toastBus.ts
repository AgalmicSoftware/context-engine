import type { ReactNode } from 'react';

export type ToastPayload = {
  id: string;
  message: string;
  kind: string;
  duration: number;
  icon: ReactNode;
};

export type ToastOptions = {
  kind?: string;
  duration?: number;
  icon?: ReactNode;
};

export type ToastListener = (payload: ToastPayload) => void;

let toastSequence = 0;
const listeners = new Set<ToastListener>();

const isToastOptions = (value: unknown): value is ToastOptions => !!value && typeof value === 'object';

const normalizeToastPayload = (message: unknown, options: unknown = {}): ToastPayload => {
  const normalizedOptions = isToastOptions(options) ? options : {};
  return {
    id: `ce-toast-${Date.now()}-${(toastSequence += 1)}`,
    message: String(message == null ? '' : message).trim(),
    kind: String(normalizedOptions.kind || 'info'),
    duration:
      typeof normalizedOptions.duration === 'number' && Number.isFinite(normalizedOptions.duration)
        ? normalizedOptions.duration
        : 4000,
    icon: normalizedOptions.icon || '',
  };
};

export const subscribeToToasts = (listener: ToastListener): (() => void) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const showToast = (message: unknown, options: ToastOptions = {}): string => {
  const payload = normalizeToastPayload(message, options);
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_) {}
  });
  return payload.id;
};
