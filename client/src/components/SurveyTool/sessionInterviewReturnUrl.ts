import { readWorkerGroupAutoJoinId } from '../../domains/worker/workerGroupAutoJoin';
import { normalizeRecruitmentSource } from './sessionRecruitmentSource';

export const buildInterviewReturnSessionUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const url = new URL(`${window.location.origin}${window.location.pathname}`);
  const source = normalizeRecruitmentSource(new URLSearchParams(window.location.search).get('src'));
  if (source) url.searchParams.set('src', source);
  const joinGroup = readWorkerGroupAutoJoinId(window.location.search);
  if (joinGroup) url.searchParams.set('joinGroup', joinGroup);
  return url.toString();
};
