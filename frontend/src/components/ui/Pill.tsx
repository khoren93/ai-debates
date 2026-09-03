import type { ReactNode } from 'react';
import { STAGE_COLORS, STAGE_LABELS, type Stage } from '../../lib/format';

interface PillProps {
  color: string;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}

/** Mono status pill with a coloured dot, e.g. "● COMPLETED". */
export const Pill = ({ color, children, pulse = false, className = '' }: PillProps) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] ${className}`}
    style={{ color }}
  >
    <span className={`size-1.5 rounded-full ${pulse ? 'animate-pulse-dot' : ''}`} style={{ background: color }} />
    {children}
  </span>
);

export const StagePill = ({ stage, className = '' }: { stage: Stage; className?: string }) => (
  <Pill color={STAGE_COLORS[stage]} pulse={stage === 'live' || stage === 'rendering'} className={className}>
    {STAGE_LABELS[stage]}
  </Pill>
);
