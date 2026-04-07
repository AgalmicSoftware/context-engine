import { createLogger } from '../logging';
import { showToast } from './toastBus.js';

const log = createLogger('notify');

const normalizeMessage = (msg) => String(msg == null ? '' : msg).trim();

export const notify = {
  success(msg) {
    const message = normalizeMessage(msg);
    log.info(message);
    return showToast(message, { kind: 'success' });
  },
  error(msg, duration = 6000) {
    const message = normalizeMessage(msg);
    log.error(message);
    return showToast(message, { kind: 'error', duration });
  },
  warn(msg, icon = '⚠️') {
    const message = normalizeMessage(msg);
    log.warn(message);
    return showToast(message, { kind: 'warn', icon });
  },
  info(msg) {
    const message = normalizeMessage(msg);
    log.info(message);
    return showToast(message, { kind: 'info', icon: 'ℹ️' });
  },
};
