import { useEffect, useState } from 'react';
import { formatCompactRelativePostTime, formatRelativePostTime } from '@/lib/formatRelativePostTime';

/**
 * Live-updating relative label when `createdAtIso` is set.
 * @param compact — shorter form (`5m`, `2h`, `Apr 12`) for feed-style rows.
 */
export function useRelativePostTime(
  createdAtIso: string | undefined,
  fallback: string,
  compact = false
): string {
  const [label, setLabel] = useState(() =>
    createdAtIso
      ? (compact ? formatCompactRelativePostTime : formatRelativePostTime)(createdAtIso)
      : fallback
  );

  useEffect(() => {
    if (!createdAtIso) {
      setLabel(fallback);
      return;
    }
    const format = compact ? formatCompactRelativePostTime : formatRelativePostTime;
    const tick = () => setLabel(format(createdAtIso));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [createdAtIso, fallback, compact]);

  return createdAtIso ? label : fallback.trim();
}
