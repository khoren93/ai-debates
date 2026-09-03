import { Audio } from '@remotion/media';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Timeline } from '../api/timeline';
import { Background } from './components/Background';
import { Captions } from './components/Captions';
import { EndCard, IntroCard, RoundChip, TopicBanner, VerdictCard } from './components/Chrome';
import { SpeakerCard } from './components/SpeakerCard';
import { ACCENT, INTRO_MS } from './constants';
import { frameToMs, msToFrame, segmentAt } from './utils';

export interface DebateProps {
  timeline: Timeline;
  mediaBase: string; // absolute URL of the debate's media folder
  [key: string]: unknown;
}

const VERDICT_LEAD_MS = 2200;

export const DebateLong = ({ timeline, mediaBase }: DebateProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = frameToMs(frame, fps) - INTRO_MS;
  const seg = segmentAt(timeline, ms);
  const debaters = timeline.speakers.filter((s) => s.role === 'debater');
  const moderator = timeline.speakers.find((s) => s.role === 'moderator');
  const judge = timeline.speakers.find((s) => s.role === 'judge');
  const active = seg ? timeline.speakers.find((s) => s.id === seg.speaker_id) : null;
  const hostActive = active?.role === 'moderator' || active?.role === 'judge';
  const inIntro = ms < 0;
  const inOutro = ms >= timeline.total_ms;
  const accent = active?.color ?? ACCENT;
  const cardWidth = debaters.length > 2 ? 320 : 420;
  const cardGap = debaters.length > 2 ? 60 : 320;

  const verdictSeg = timeline.segments.find((s) => s.turn_type === 'verdict');
  const verdictAt = timeline.verdict?.winner_id ? (verdictSeg ? verdictSeg.end_ms - VERDICT_LEAD_MS : timeline.total_ms) : Infinity;
  const showVerdict = ms >= verdictAt;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Background accent={accent} />
      <Sequence from={msToFrame(INTRO_MS)} durationInFrames={msToFrame(timeline.total_ms) + 2} premountFor={fps}>
        <Audio src={`${mediaBase}/${timeline.full_audio_wav}`} />
      </Sequence>

      {inIntro && <IntroCard timeline={timeline} big />}

      {!inIntro && !inOutro && (
        <div style={{ position: 'absolute', inset: 0, opacity: showVerdict ? 0.05 : 1 }}>
          <div style={{ position: 'absolute', top: 48, left: 0, right: 0 }}>
            <TopicBanner topic={timeline.topic} fontSize={44} maxWidth={1400} />
          </div>
          <div style={{ position: 'absolute', top: 178, left: 0, right: 0, textAlign: 'center' }}>
            {seg && <RoundChip roundId={seg.round_id} fontSize={22} />}
          </div>

          <div style={{ position: 'absolute', top: 250, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: cardGap, alignItems: 'flex-start' }}>
            {debaters.map((d) => (
              <SpeakerCard key={d.id} speaker={d} seg={seg} offsetMs={INTRO_MS} active={active?.id === d.id} width={cardWidth} compact={debaters.length > 2} />
            ))}
          </div>

          {moderator && debaters.length <= 2 && (
            <div style={{ position: 'absolute', top: 360, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 220, opacity: hostActive ? 1 : 0.4 }}>
                <SpeakerCard speaker={active?.role === 'judge' && judge ? judge : moderator} seg={seg} offsetMs={INTRO_MS} active={hostActive} width={220} compact />
              </div>
            </div>
          )}

          {!showVerdict && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70 }}>
              <Captions seg={seg} offsetMs={INTRO_MS} color={accent} fontSize={56} maxWidth={1500} />
            </div>
          )}
        </div>
      )}

      {showVerdict && <VerdictCard timeline={timeline} big sinceMs={ms - verdictAt} />}
      {inOutro && !timeline.verdict?.winner_id && <EndCard big text="Thanks for watching" sinceMs={ms - timeline.total_ms} />}
    </AbsoluteFill>
  );
};
