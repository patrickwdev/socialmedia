import { useEffect, useState } from 'react';
import { formatRelativePostTime } from '@/lib/formatRelativePostTime';

/**
 * Live-updating relative label (e.g. "Just now" → "10 minutes ago") when `createdAtIso` is set.
 */
export function useRelativePostTime(createdAtIso: string | undefined, fallback: string): string {
  const [label, setLabel] = useState(() =>
    createdAtIso ? formatRelativePostTime(createdAtIso) : fallback
  );

  useEffect(() => {
    if (!createdAtIso) {
      setLabel(fallback);
      return;
    }
    const tick = () => setLabel(formatRelativePostTime(createdAtIso));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [createdAtIso, fallback]);

  return createdAtIso ? label : fallback;
}
