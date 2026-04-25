let toastSequence = 0;
const listeners = new Set<(payload: any) => void>();

const normalizeToastPayload = (message: any, options: any = {}) => ({
  id: `ce-toast-${Date.now()}-${toastSequence += 1}`,
  message: String(message == null ? '' : message).trim(),
  kind: String(options.kind || 'info'),
  duration: Number.isFinite(options.duration) ? options.duration : 4000,
  icon: options.icon || '',
});

export const subscribeToToasts = (listener: any): (() => void) => {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const showToast = (message: any, options: any = {}): string => {
  const payload = normalizeToastPayload(message, options);
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_) {}
  });
  return payload.id;
};
