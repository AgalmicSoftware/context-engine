import { useEffect, useState } from 'react';

// "s" is the symbol for seconds, so it stays lower case on a button that sets its words in capitals ("SAVING · 3s").
const SECONDS_STYLE = { textTransform: 'none' } as const;

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
        · {seconds}s
      </span>
    </span>
  );
}
