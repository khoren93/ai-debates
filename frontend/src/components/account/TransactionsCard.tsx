import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { listTransactions } from '../../api/billing';
import { getErrorMessage } from '../../api/client';
import type { Transaction } from '../../api/types';
import { formatDateShort, formatSigned } from '../../lib/format';
import { Card, EmptyState, ErrorBox, SectionLabel, Spinner } from '../ui';
import { humanizeKind, money } from './helpers';

const LIMIT = 20;

/** "LEDGER" card: the latest credit top-ups and charges. */
export const TransactionsCard = ({ reloadKey, className = '' }: { reloadKey: number; className?: string }) => {
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTransactions(LIMIT)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
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
    <Card className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>Ledger</SectionLabel>
        {items && items.length > 0 && <span className="font-mono text-[11px] text-dim">last {items.length}</span>}
      </div>
      {error ? (
        <ErrorBox className="mt-3">{error}</ErrorBox>
      ) : items === null ? (
        <div className="mt-3 flex items-center gap-2 py-6 text-xs text-muted">
          <Spinner className="size-4" /> Loading transactions…
        </div>
      ) : items.length === 0 ? (
        <EmptyState className="mt-3" icon={<Receipt className="size-5" />} title="No transactions yet" text="Top-ups and debate charges will show up here." />
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {items.map((t) => {
            const label = t.description?.trim() || humanizeKind(t.kind);
            return (
              <li key={t.id} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 text-[13px] sm:grid-cols-[84px_minmax(0,1fr)_auto_72px]">
                <span className="font-mono text-xs text-dim">{formatDateShort(t.created_at)}</span>
                {t.debate_id ? (
                  <Link to={`/debate/${t.debate_id}`} className="truncate text-text-2 hover:text-text hover:underline" title={label}>
                    {label}
                  </Link>
                ) : (
                  <span className="truncate text-text-2" title={label}>
                    {label}
                  </span>
                )}
                <span className={`text-right font-mono ${t.amount_usd > 0 ? 'text-ok' : 'text-text'}`}>{formatSigned(t.amount_usd)}</span>
                <span className="hidden text-right font-mono text-xs text-muted sm:block">{money(t.balance_after_usd)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
