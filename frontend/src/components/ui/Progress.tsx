interface ProgressProps {
  value: number; // 0..1
  color?: string;
  gradient?: boolean;
  className?: string;
  height?: number;
}

export const Progress = ({ value, color = '#D9FF3D', gradient = false, className = '', height = 4 }: ProgressProps) => (
  <div className={`w-full overflow-hidden rounded-full bg-surface-3 ${className}`} style={{ height }}>
    <div
      className="h-full rounded-full transition-[width] duration-300"
      style={{
        width: `${Math.max(0, Math.min(100, value * 100))}%`,
        background: gradient ? 'linear-gradient(90deg,#6C9CFF,#D9FF3D)' : color,
      }}
    />
  </div>
);
