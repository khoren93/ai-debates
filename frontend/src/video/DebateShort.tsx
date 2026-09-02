import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Timeline } from '../api/timeline';
import { Background } from './components/Background';
import { Captions } from './components/Captions';
import { EndCard } from './components/Chrome';
import { SpeakerCard } from './components/SpeakerCard';
import { FONT, SHORT_HOOK_MS } from './constants';
import { frameToMs, highlightRange, msToFrame } from './utils';

export interface ShortProps {
  timeline: Timeline;
  mediaBase: string;
  highlightIndex: number;
  [key: string]: unknown;
}

export const DebateShort = ({ timeline, mediaBase, highlightIndex }: ShortProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const h = highlightRange(timeline, highlightIndex);
  const len = h.end_ms - h.start_ms;
  const localMs = frameToMs(frame, fps) - SHORT_HOOK_MS; // 0 = start of the highlight
  const absMs = h.start_ms + localMs;
  const seg = localMs >= 0 && localMs < len ? timeline.segments.find((s) => absMs >= s.start_ms && absMs < s.end_ms) ?? null : null;
  const active = seg ? timeline.speakers.find((s) => s.id === seg.speaker_id) : null;
  const debaters = timeline.speakers.filter((s) => s.role === 'debater');
  const accent = active?.color ?? '#22d3ee';
  const inHook = localMs < 0;
  const inEnd = localMs >= len;
  const progress = Math.max(0, Math.min(1, localMs / len));
  // Segment times are absolute; the composition clock starts at the hook card.
  const offsetMs = SHORT_HOOK_MS - h.start_ms;
  const cardWidth = debaters.length > 2 ? 300 : 440;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Background accent={accent} />
      <Sequence from={msToFrame(SHORT_HOOK_MS)} durationInFrames={msToFrame(len) + 2} premountFor={fps}>
        <Audio src={`${mediaBase}/${timeline.full_audio_wav}`} trimBefore={msToFrame(h.start_ms)} trimAfter={msToFrame(h.end_ms)} />
      </Sequence>

      {inHook && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 70, textAlign: 'center', fontFamily: FONT, gap: 30, opacity: interpolate(frame / fps, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' }) }}>
          <div style={{ fontSize: 30, letterSpacing: 8, color: '#22d3ee', fontWeight: 800 }}>AI DEBATES</div>
          <div style={{ fontSize: 80, fontWeight: 900, color: '#fff', lineHeight: 1.08 }}>{h.hook}</div>
          <div style={{ fontSize: 36, color: '#ffffffb3', fontWeight: 600 }}>
            {debaters.map((d, i) => (
              <span key={d.id}>
                {i > 0 && ' vs '}
                <span style={{ color: d.color }}>{d.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {!inHook && !inEnd && (
        <>
          <div style={{ position: 'absolute', top: 90, left: 0, right: 0, textAlign: 'center', fontFamily: FONT }}>
            <div style={{ fontSize: 26, letterSpacing: 8, color: '#22d3ee', fontWeight: 800 }}>AI DEBATES</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', padding: '8px 50px', lineHeight: 1.15 }}>{timeline.topic}</div>
          </div>
          <div style={{ position: 'absolute', top: 330, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 50, flexWrap: 'wrap' }}>
            {debaters.map((d) => (
              <SpeakerCard key={d.id} speaker={d} seg={seg} offsetMs={offsetMs} active={active?.id === d.id} width={cardWidth} compact />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 960, height: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Captions seg={seg} offsetMs={offsetMs} color={accent} fontSize={80} maxWidth={1000} combineMs={900} />
          </div>
          <div style={{ position: 'absolute', left: 60, right: 60, bottom: 110, height: 12, borderRadius: 6, background: '#ffffff22' }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 6, background: accent }} />
          </div>
        </>
      )}

      {inEnd && <EndCard big={false} text="Who won? Full debate on the channel" sinceMs={localMs - len} />}
    </AbsoluteFill>
  );
};
