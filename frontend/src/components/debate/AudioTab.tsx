import { Download, Play, RefreshCw, Sparkles } from 'lucide-react';
import { useState, type RefObject } from 'react';
import type { Timeline } from '../../api/timeline';
import type { DebateMedia } from '../../api/types';
import { useAudioClock } from '../../hooks/useAudioClock';
import { formatDuration } from '../../lib/format';
import { Button, EmptyState, Progress } from '../ui';
import { msLabel, prettyVoice } from './helpers';

interface Props {
  media: DebateMedia | null;
  timeline: Timeline | null;
  isOwner: boolean;
  completed: boolean;
  onGenerate: () => void;
  /** Lets the page seek the track (timeline bar clicks). */
  audioRef: RefObject<HTMLAudioElement | null>;
}

/** Audio tab: mixed track, karaoke transcript and per-speaker voices. */
export const AudioTab = ({ media, timeline, isOwner, completed, onGenerate, audioRef }: Props) => {
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const attach = (el: HTMLAudioElement | null) => {
    audioRef.current = el;
    setAudioEl(el);
  };
  const clockMs = useAudioClock(audioEl);
  const status = media?.media_status ?? 'none';

  if (status === 'queued' || status === 'running') {
    const p = media?.progress;
    const pct = p && p.total > 0 ? p.current / p.total : 0;
    return (
      <div className="mt-5 rounded-panel border border-line bg-surface p-5">
        <div className="font-mono text-[11px] tracking-[0.1em] text-host">RENDERING AUDIO</div>
        <div className="mt-2 text-sm text-text-2">{p?.message || 'Queued'}</div>
        <Progress value={pct} className="mt-3" gradient height={5} />
      </div>
    );
  }
  if (status !== 'ready' || !media?.urls || !timeline) {
    return (
      <EmptyState
        className="mt-5"
        icon={<Sparkles className="size-5" />}
        title="No audio yet"
        text={media?.progress?.error ? `The last build failed: ${media.progress.error}` : completed ? 'Voice the debate with neural voices to unlock the video and the Short.' : 'Audio can be generated once the debate has finished.'}
        action={isOwner && completed ? <Button onClick={onGenerate}>Generate audio</Button> : undefined}
      />
    );
  }

  const seek = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = ms / 1000;
    void audio.play();
  };
  const activeSeg = timeline.segments.findIndex((s) => clockMs >= s.start_ms && clockMs < s.end_ms + timeline.gap_ms);
  const chars = new Map<string, number>();
  for (const seg of timeline.segments) chars.set(seg.speaker_id, (chars.get(seg.speaker_id) ?? 0) + seg.text.length);

  return (
    <div className="mt-5 grid gap-4">
      <audio ref={attach} controls src={media.urls.full_mp3} className="w-full" preload="metadata" />
      <div className="grid gap-2.5">
        {timeline.speakers.map((sp) => {
          const first = timeline.segments.find((s) => s.speaker_id === sp.id);
          return (
            <div key={sp.id} className="flex items-center gap-3.5 rounded-[14px] border border-line bg-surface px-4 py-3.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: sp.color }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{sp.name}</div>
                <div className="text-xs text-muted">{prettyVoice(sp.voice_id) ?? `${timeline.provider} voice`} · {sp.model}</div>
              </div>
              <div className="font-mono text-[11px] text-muted">{(chars.get(sp.id) ?? 0).toLocaleString()} ch</div>
              <button
                type="button"
                onClick={() => first && seek(first.start_ms)}
                disabled={!first}
                className="grid size-[34px] place-items-center rounded-[10px] bg-surface-2 text-text hover:bg-surface-3 disabled:opacity-40 cursor-pointer"
                aria-label={`Play ${sp.name}`}
              >
                <Play className="size-3 fill-current" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {isOwner && (
          <Button variant="secondary" size="sm" onClick={onGenerate} icon={<RefreshCw className="size-3.5" />}>
            Regenerate audio
          </Button>
        )}
        <a href={media.urls.full_mp3} download={`debate-${media.debate_id}.mp3`} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-line-2 bg-surface px-3.5 text-[13px] font-semibold hover:bg-surface-2">
          <Download className="size-3.5" /> Download MP3
        </a>
        <span className="font-mono text-[11px] text-muted">
          {formatDuration(timeline.total_ms)} · {timeline.segments.length} turns · {timeline.provider}
          {media.stats?.estimated_usd != null && ` · ~$${media.stats.estimated_usd}`}
        </span>
      </div>
      <div className="grid gap-2">
        {timeline.segments.map((seg, i) => {
          const speaker = timeline.speakers.find((s) => s.id === seg.speaker_id);
          const rel = clockMs - seg.start_ms;
          return (
            <div key={seg.seq_index} className={`rounded-[14px] border p-3.5 text-sm transition-colors ${i === activeSeg ? 'border-accent/50 bg-surface' : 'border-line bg-ink'}`}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="inline-block size-2.5 rounded-full" style={{ background: speaker?.color ?? '#999' }} />
                <b className="text-text">{seg.speaker_name}</b>
                <span className="font-mono">
                  {msLabel(seg.start_ms)}–{msLabel(seg.end_ms)}
                </span>
                <button type="button" onClick={() => seek(seg.start_ms)} className="inline-flex items-center gap-1 text-accent hover:text-accent-hover cursor-pointer">
                  <Play className="size-3 fill-current" /> play from here
                </button>
              </div>
              <p className="leading-relaxed">
                {seg.words.map((w, j) => (
                  <span key={j} className={rel >= w.s && rel < w.e ? 'rounded bg-accent px-0.5 text-ink' : rel >= w.e ? 'text-text' : 'text-muted'}>
                    {w.w}{' '}
                  </span>
                ))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
