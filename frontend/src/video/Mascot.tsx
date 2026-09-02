import type { Mascot as MascotKind } from '../api/timeline';

/** Self-contained SVG mascots (no external assets, no vendor logos). */
export const Mascot = ({ kind, color, size, mouth = 0, talking = false }: { kind: MascotKind; color: string; size: number; mouth?: number; talking?: boolean }) => {
  const m = Math.max(2, Math.min(18, mouth * 26));
  const eye = talking ? 7 : 6;
  const gradientId = `g-${kind}-${color.replace('#', '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {kind === 'orb' && <circle cx="50" cy="52" r="38" fill={`url(#${gradientId})`} />}
      {kind === 'bolt' && <path d="M22 20 h56 a10 10 0 0 1 10 10 v40 a10 10 0 0 1 -10 10 h-56 a10 10 0 0 1 -10 -10 v-40 a10 10 0 0 1 10 -10z" fill={`url(#${gradientId})`} />}
      {kind === 'cube' && <path d="M50 12 L88 32 L88 72 L50 92 L12 72 L12 32 Z" fill={`url(#${gradientId})`} />}
      <rect x="47" y="6" width="6" height="12" rx="3" fill={color} opacity="0.9" />
      <circle cx="50" cy="6" r="4" fill="#fff" opacity="0.9" />
      <ellipse cx="37" cy="46" rx={eye} ry={eye + 1} fill="#0b1020" />
      <ellipse cx="63" cy="46" rx={eye} ry={eye + 1} fill="#0b1020" />
      <circle cx="39" cy="44" r="2.2" fill="#fff" />
      <circle cx="65" cy="44" r="2.2" fill="#fff" />
      <rect x={50 - 11} y={64 - m / 2} width="22" height={m} rx={Math.min(6, m / 2)} fill="#0b1020" />
    </svg>
  );
};
