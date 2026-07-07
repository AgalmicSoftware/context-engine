import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';

export type SessionMediaUrlOptions = {
  gateway?: unknown;
  contextLabel?: unknown;
};

export const normalizeSessionMediaUrl = (value: unknown, options: SessionMediaUrlOptions = {}): string =>
  normalizeArweaveUrl(value, options);
