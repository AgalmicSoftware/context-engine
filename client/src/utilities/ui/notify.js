import toast from 'react-hot-toast';
import { createLogger } from '../logging';

const log = createLogger('notify');

const normalizeMessage = (msg) => String(msg == null ? '' : msg).trim();

export const notify = {
  success(msg) {
    const message = normalizeMessage(msg);
    log.info(message);
    return toast.success(message);
  },
  error(msg, duration = 6000) {
    const message = normalizeMessage(msg);
    log.error(message);
    return toast.error(message, { duration });
  },
  warn(msg, icon = '⚠️') {
    const message = normalizeMessage(msg);
    log.warn(message);
    return toast(message, { icon });
  },
  info(msg) {
    const message = normalizeMessage(msg);
    log.info(message);
    return toast(message, { icon: 'ℹ️' });
  },
};
