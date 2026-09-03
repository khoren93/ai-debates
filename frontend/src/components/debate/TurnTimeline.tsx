export interface TimelineItem {
  key: number;
  label: string;
  color: string;
  flex: number;
  title: string;
}

interface Props {
  items: TimelineItem[];
  activeKey?: number | null;
  onSelect?: (key: number) => void;
  className?: string;
}

/** Horizontal bar of turns, proportional to their length, coloured per speaker. */
export const TurnTimeline = ({ items, activeKey = null, onSelect, className = '' }: Props) => {
  if (items.length === 0) return null;
  return (
    <div className={`flex h-[34px] gap-1 ${className}`} role="list">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="listitem"
          title={it.title}
          onClick={() => onSelect?.(it.key)}
          className={`flex min-w-[14px] items-center justify-center overflow-hidden rounded-md font-mono text-[10px] font-semibold text-ink transition-opacity ${
            activeKey === it.key ? 'opacity-100 ring-2 ring-white/60' : 'opacity-85 hover:opacity-100'
          }`}
          style={{ flex: it.flex, background: it.color }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
};
