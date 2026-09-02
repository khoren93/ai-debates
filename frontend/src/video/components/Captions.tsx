import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimelineSegment } from '../../api/timeline';
import { FONT } from '../constants';
import { captionPages, frameToMs } from '../utils';

/** Karaoke captions: a page of a few words, the current word in the speaker's colour. */
export const Captions = ({ seg, offsetMs, color, fontSize, maxWidth, combineMs = 1200 }: { seg: TimelineSegment | null; offsetMs: number; color: string; fontSize: number; maxWidth: number; combineMs?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = frameToMs(frame, fps) - offsetMs;
  if (!seg) return null;
  const pages = captionPages(seg, combineMs);
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs) ?? (ms >= seg.end_ms - 400 ? pages[pages.length - 1] : null);
  if (!page) return null;
  return (
    <div style={{ maxWidth, margin: '0 auto', textAlign: 'center', fontFamily: FONT, fontWeight: 800, fontSize, lineHeight: 1.25, textShadow: '0 4px 24px #000c', padding: '0 24px' }}>
      {page.tokens.map((t, i) => {
        const now = ms >= t.fromMs && ms < t.toMs;
        const spoken = ms >= t.toMs;
        return (
          <span key={i} style={{ color: now ? color : spoken ? '#fff' : '#ffffffb3', transform: now ? 'scale(1.08)' : 'none', display: 'inline-block', marginRight: '0.3em' }}>
            {t.text.trim()}
          </span>
        );
      })}
    </div>
  );
};
