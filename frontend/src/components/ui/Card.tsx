import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: 'surface' | 'ink' | 'accent';
}

const PAD = { none: '', sm: 'p-4', md: 'p-5 md:p-6', lg: 'p-5 md:p-7' };
const TONE = {
  surface: 'bg-surface border border-line',
  ink: 'bg-ink border border-line',
  accent: 'bg-[linear-gradient(140deg,#1a2114,#12141b)] border border-accent/25',
};

/** Rounded panel on the dark canvas. */
export const Card = ({ padding = 'md', tone = 'surface', className = '', children, ...rest }: CardProps) => (
  <div className={`rounded-panel ${TONE[tone]} ${PAD[padding]} ${className}`} {...rest}>
    {children}
  </div>
);

/** Small mono uppercase label, e.g. "CREDITS". */
export const SectionLabel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`font-mono text-[11px] uppercase tracking-[0.08em] text-muted ${className}`}>{children}</div>
);

/** Section heading with an optional hint on the right. */
export const SectionTitle = ({ children, hint, className = '' }: { children: ReactNode; hint?: ReactNode; className?: string }) => (
  <div className={`flex items-baseline justify-between gap-3 flex-wrap ${className}`}>
    <div className="text-[13px] font-semibold text-text-3">{children}</div>
    {hint && <div className="text-xs text-muted">{hint}</div>}
  </div>
);

/** Big number with a label (library stats, estimate). */
export const Stat = ({ label, value, className = '' }: { label: ReactNode; value: ReactNode; className?: string }) => (
  <div className={className}>
    <div className="font-display text-2xl md:text-[26px] font-bold tracking-tight">{value}</div>
    <div className="text-xs text-muted mt-0.5">{label}</div>
  </div>
);
