import { toStr } from '../../utilities/shared/primitives.js';

export type AdminLinkedResult = {
  label?: string;
  text?: string;
  href?: string;
};

export type AdminTestResult = string | AdminLinkedResult;
export type AdminTestResults = Record<string, AdminTestResult>;

export const isAdminLinkedResult = (entry: unknown): entry is AdminLinkedResult => !!entry && typeof entry === 'object';

export const renderAdminTestResult = (entry: AdminTestResult | null | undefined) => {
  if (!entry) return 'Not run';
  if (typeof entry === 'string') return entry;
  if (!isAdminLinkedResult(entry)) return 'OK';
  const label = toStr(entry.label || entry.text).trim();
  const href = toStr(entry.href).trim();
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {label || 'View'}
      </a>
    );
  }
  return label || 'OK';
};
