import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimelineSegment } from '../../api/timeline';
import { frameToMs, levelAt } from '../utils';

/** Loudness bars around the current moment, taken from the segment's precomputed levels. */
export const Waveform = ({ seg, offsetMs, color, width, height, bars = 24 }: { seg: TimelineSegment | null; offsetMs: number; color: string; width: number; height: number; bars?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = frameToMs(frame, fps) - offsetMs;
  const gap = width / bars;
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: gap * 0.35 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const v = seg ? levelAt(seg, ms + (i - bars / 2) * 45) : 0;
        return <div key={i} style={{ width: gap * 0.65, height: Math.max(4, v * height), borderRadius: 4, background: color, opacity: 0.35 + v * 0.65 }} />;
      })}
    </div>
  );
};
