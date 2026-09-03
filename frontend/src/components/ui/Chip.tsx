import type { ReactNode } from 'react';

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  color?: string; // active colour override (speaker colour for persona chips)
  size?: 'sm' | 'md';
  className?: string;
  children: ReactNode;
  title?: string;
}

/** Selectable pill (filters, personas, categories, top-up amounts). */
export const Chip = ({ active = false, onClick, color, size = 'md', className = '', children, title }: ChipProps) => {
  const style = active && color ? { background: color, borderColor: color, color: '#0A0B0F' } : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap transition-colors cursor-pointer ${
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-[13px]'
      } ${active ? 'bg-accent border-accent text-ink' : 'bg-surface-2 border-line-2 text-text-2 hover:border-line-3 hover:text-text'} ${className}`}
      style={style}
      aria-pressed={active}
    >
      {children}
    </button>
  );
};

/** Static tag, e.g. "MP3", "MP4". */
export const Tag = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center rounded-md bg-surface-3 px-2 py-0.5 font-mono text-[10px] text-text-3 ${className}`}>{children}</span>
);
