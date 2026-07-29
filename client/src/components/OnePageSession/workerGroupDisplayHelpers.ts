export type WorkerGroupJoinWindowDisplay =
  | { status: 'never'; countdownText: ''; fullDateText: '' }
  | { status: 'active'; countdownText: string; fullDateText: string }
  | { status: 'expired'; countdownText: ''; fullDateText: string };

const formatWorkerGroupRemainingTime = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

export const resolveWorkerGroupJoinWindowDisplay = ({
  joinEndsAt,
  nowMs = Date.now(),
}: {
  joinEndsAt?: unknown;
  nowMs?: number;
}): WorkerGroupJoinWindowDisplay => {
  const rawJoinEndsAt = String(joinEndsAt || '').trim();
  if (!rawJoinEndsAt) return { status: 'never', countdownText: '', fullDateText: '' };
  const endMs = Date.parse(rawJoinEndsAt);
  if (!Number.isFinite(endMs)) return { status: 'never', countdownText: '', fullDateText: '' };
  const fullDateText = new Date(endMs).toLocaleString();
  if (endMs <= nowMs) return { status: 'expired', countdownText: '', fullDateText };
  return {
    status: 'active',
    countdownText: formatWorkerGroupRemainingTime(endMs - nowMs),
    fullDateText,
  };
};
