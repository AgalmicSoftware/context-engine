import { useEffect, useState } from 'react';

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
      <span aria-hidden="true"> · {seconds}s</span>
    </span>
  );
}
