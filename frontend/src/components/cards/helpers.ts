import type { Participant, Verdict } from '../../api/types';
import { shortModelName } from '../../lib/format';

/** Display names of the debaters (moderator excluded), in speaking order. */
export const debaterNames = (participants: Participant[]): string[] =>
  participants
    .filter((p) => p.role !== 'moderator')
    .map((p) => p.name?.trim() || shortModelName(p.model) || 'Debater');

/** "Alice wins" / "Draw" for a verdict, or null when there is nothing to show. */
export const verdictLabel = (verdict: Verdict | null | undefined): { text: string; draw: boolean } | null => {
  if (!verdict) return null;
  if (verdict.is_draw) return { text: 'Draw', draw: true };
  if (verdict.winner_name) return { text: `${verdict.winner_name} wins`, draw: false };
  return null;
};
