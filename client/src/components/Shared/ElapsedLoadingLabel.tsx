import { useEffect, useState } from 'react';

// Keep elapsed seconds visual: live regions should announce the task, not every tick.
export default function ElapsedLoadingLabel({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span>
      {label}
      <span aria-hidden="true"> · {seconds}s</span>
    </span>
  );
}
