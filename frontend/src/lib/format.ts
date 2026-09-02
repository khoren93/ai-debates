import type { DebateStatus, Turn } from '../api/types';

/** Completion price per 1M tokens, e.g. "$0.60". */
export const formatPrice = (pricing: { completion: string }) =>
  `$${(parseFloat(pricing.completion) * 1_000_000).toFixed(2)}`;

export const formatContext = (length: number) => {
  if (!length) return '?';
  if (length >= 1_000_000) return `${Math.round(length / 1_000_000)}M`;
  if (length >= 1000) return `${Math.round(length / 1000)}k`;
  return `${length}`;
};

export const formatCost = (cost: number) => {
  if (!cost) return '$0.00';
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
};

export const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString() : '';

export const STATUS_STYLES: Record<DebateStatus, string> = {
  queued: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  stopped: 'bg-gray-200 text-gray-700',
};

export const statusStyle = (status: string) =>
  STATUS_STYLES[status as DebateStatus] ?? 'bg-gray-100 text-gray-700';

/** Turns saved before v0.2 stored errors inline as "[Error ...]" text. */
export const isErrorTurn = (turn: Pick<Turn, 'error' | 'text'>) =>
  Boolean(turn.error) || turn.text.trim().startsWith('[Error');

export const turnErrorMessage = (turn: Pick<Turn, 'error' | 'text'>) => {
  if (turn.error) return turn.error;
  const legacy = turn.text.trim();
  const match = legacy.match(/OpenRouter Error \d+: (.*)/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].replace(/\]$/, ''));
      if (parsed?.error?.message) return `API Error: ${parsed.error.message}`;
    } catch {
      /* fall through */
    }
  }
  return legacy.replace(/^\[Error(?: generating response)?:?\s*/, '').replace(/\]$/, '');
};

export const roundLabel = (roundId: string) => {
  if (roundId === 'verdict') return 'Verdict';
  const match = roundId.match(/^round_(\d+)$/);
  return match ? `Round ${match[1]}` : roundId;
};
