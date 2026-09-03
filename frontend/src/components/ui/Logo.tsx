import { APP_NAME } from '../../lib/brand';

/** Accent square with three bars + wordmark. */
export const Logo = ({ size = 30, wordmark = true }: { size?: number; wordmark?: boolean }) => (
  <span className="inline-flex items-center gap-2.5">
    <span className="grid place-items-center rounded-[9px] bg-accent" style={{ width: size, height: size }}>
      <span className="flex items-end gap-[3px]" style={{ height: size * 0.47 }}>
        <span className="w-[3px] rounded-[2px] bg-ink" style={{ height: '57%' }} />
        <span className="w-[3px] rounded-[2px] bg-ink" style={{ height: '100%' }} />
        <span className="w-[3px] rounded-[2px] bg-ink" style={{ height: '71%' }} />
      </span>
    </span>
    {wordmark && <span className="font-display text-lg font-bold tracking-tight">{APP_NAME}</span>}
  </span>
);

/** Animated equalizer bars (live / rendering indicators). */
export const Bars = ({ color = '#D9FF3D', height = 22 }: { color?: string; height?: number }) => (
  <span className="flex items-end gap-[3px]" style={{ height }}>
    {[0, 0.15, 0.3, 0.45].map((delay) => (
      <span key={delay} className="w-[3px] origin-bottom animate-bars" style={{ background: color, height: '100%', animationDelay: `${delay}s` }} />
    ))}
  </span>
);
