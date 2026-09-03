import type { ReactNode } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  grow?: boolean;
}

/** Pill-style segmented control (filters, rounds, reply length, player format). */
export function Segmented<T extends string | number>({ options, value, onChange, className = '', size = 'md', grow = false }: SegmentedProps<T>) {
  return (
    <div className={`inline-flex gap-1 rounded-field border border-line bg-ink p-1 overflow-x-auto max-w-full ${grow ? 'w-full' : ''} ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-[9px] font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 ${grow ? 'flex-1 text-center' : ''} ${
              size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px]'
            } ${active ? 'bg-accent text-ink' : 'text-muted hover:text-text'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
