import { useEffect, useState } from 'react';
import { getUsage } from '../../api/billing';
import { getErrorMessage } from '../../api/client';
import type { Usage } from '../../api/types';
import { formatCost, formatDateShort, formatTokens } from '../../lib/format';
import { Card, Progress, SectionLabel, Spinner } from '../ui';

const usageRows = (u: Usage) => {
  const tokens = u.tokens_in + u.tokens_out;
  const minutes = u.voice_ms / 60_000;
  return [
    { label: 'Model tokens', value: formatTokens(tokens), pct: Math.min(1, tokens / 500_000), color: '#6C9CFF' },
    { label: 'Voice minutes', value: `${Math.round(minutes)} min`, pct: Math.min(1, minutes / 60), color: '#FFC46B' },
    { label: 'Renders', value: `${u.renders}`, pct: Math.min(1, u.renders / 20), color: '#D9FF3D' },
  ];
};

/** "THIS MONTH" usage bars; re-fetches whenever `reloadKey` changes (e.g. the balance). */
export const UsageCard = ({ reloadKey }: { reloadKey: number }) => {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUsage()
      .then((u) => {
        if (cancelled) return;
        setUsage(u);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>This month</SectionLabel>
        {usage && <span className="font-mono text-[11px] text-dim">since {formatDateShort(usage.period_start)}</span>}
      </div>
      {error ? (
        <div className="mt-3 text-xs text-con">{error}</div>
      ) : !usage ? (
        <div className="mt-3 flex min-h-[112px] items-center gap-2 text-xs text-muted">
          <Spinner className="size-4" /> Loading usage…
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-2.5">
            {usageRows(usage).map((row) => (
              <div key={row.label}>
                <div className="flex justify-between gap-3 text-[13px]">
                  <span>{row.label}</span>
                  <span className="font-mono text-text-3">{row.value}</span>
                </div>
                <Progress value={row.pct} color={row.color} className="mt-1.5" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
            <span>
              Spent {formatCost(usage.spent_usd)} · Topped up {formatCost(usage.topped_up_usd)}
            </span>
            <span>
              {usage.debates} {usage.debates === 1 ? 'debate' : 'debates'}
            </span>
          </div>
        </>
      )}
    </Card>
  );
};
