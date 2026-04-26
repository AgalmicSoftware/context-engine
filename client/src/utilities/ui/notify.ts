import { createLogger } from '../logging';
import { showToast } from './toastBus.js';

const log = createLogger('notify');
type ToastHandle = ReturnType<typeof showToast>;

const normalizeMessage = (msg: unknown): string => String(msg == null ? '' : msg).trim();

export const notify = {
  success(msg: unknown): ToastHandle {
    const message = normalizeMessage(msg);
    log.info(message);
    return showToast(message, { kind: 'success' });
  },
  error(msg: unknown, duration = 6000): ToastHandle {
    const message = normalizeMessage(msg);
    log.error(message);
    return showToast(message, { kind: 'error', duration });
  },
  warn(msg: unknown, icon = '⚠️'): ToastHandle {
    const message = normalizeMessage(msg);
    log.warn(message);
    return showToast(message, { kind: 'warn', icon });
  },
  info(msg: unknown): ToastHandle {
    const message = normalizeMessage(msg);
    log.info(message);
    return showToast(message, { kind: 'info', icon: 'ℹ️' });
  },
};
