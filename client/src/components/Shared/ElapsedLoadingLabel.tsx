import { useEffect, useState } from 'react';

const SECONDS_PER_MINUTE = 60;
// "s" is the symbol for seconds, so it stays lower case on a button that sets its words in capitals ("SAVING · 3s").
// Even figures, so a button keeps its width as the count moves.
const SECONDS_STYLE = { textTransform: 'none', fontVariantNumeric: 'tabular-nums' } as const;

/** "12s" under a minute, then "1:30", so a wait of minutes reads at a glance. */
export const formatElapsedSeconds = (seconds: number): string =>
  seconds < SECONDS_PER_MINUTE
    ? `${seconds}s`
    : `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;

// Keep elapsed seconds visual: live regions should announce the task, not every tick.
// Counts from `since` when the task started before this label appeared.
export default function ElapsedLoadingLabel({ label, since = null }: { label: string; since?: number | null }) {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(mountedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - (since ?? mountedAt)) / 1000));
  return (
    <span>
      {label}
      <span aria-hidden="true" style={SECONDS_STYLE}>
        {' '}
        · {formatElapsedSeconds(seconds)}
      </span>
    </span>
  );
}
