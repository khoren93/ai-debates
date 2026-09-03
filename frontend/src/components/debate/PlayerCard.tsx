import { Player } from '@remotion/player';
import { Sparkles } from 'lucide-react';
import type { Timeline } from '../../api/timeline';
import type { DebateMedia } from '../../api/types';
import { FPS, LONG_H, LONG_W, SHORT_H, SHORT_W } from '../../video/constants';
import { DebateLong } from '../../video/DebateLong';
import { DebateShort } from '../../video/DebateShort';
import { longDurationInFrames, shortDurationInFrames } from '../../video/utils';
import { Button, Progress, Segmented } from '../ui';

interface Props {
  media: DebateMedia | null;
  timeline: Timeline | null;
  mediaBase: string;
  format: 'long' | 'short';
  onFormat: (f: 'long' | 'short') => void;
  highlightIndex: number;
  isOwner: boolean;
  completed: boolean;
  onGenerate: () => void;
}

/** Video preview (Remotion Player) with the 16:9 / 9:16 switch, or the audio build state. */
export const PlayerCard = ({ media, timeline, mediaBase, format, onFormat, highlightIndex, isOwner, completed, onGenerate }: Props) => {
  const status = media?.media_status ?? 'none';

  if (status === 'queued' || status === 'running') {
    const p = media?.progress;
    const pct = p && p.total > 0 ? p.current / p.total : 0;
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-panel border border-line-2 bg-ink-2 p-8 text-center" style={{ aspectRatio: '16/9' }}>
        <div className="font-mono text-[11px] tracking-[0.1em] text-host">RENDERING AUDIO · {status.toUpperCase()}</div>
        <div className="font-display text-[clamp(18px,2.4vw,26px)] font-bold tracking-tight">{p?.message || 'Queued'}</div>
        <Progress value={pct} gradient height={5} className="max-w-sm" />
        <div className="text-xs text-muted">{p && p.total > 0 ? `${p.current} / ${p.total} turns` : 'The video unlocks as soon as the track is mixed'}</div>
      </div>
    );
  }

  if (!timeline || !media?.urls) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-panel border border-dashed border-line-2 bg-ink-2 p-8 text-center" style={{ aspectRatio: '16/9' }}>
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Sparkles className="size-5" />
        </span>
        <div className="font-display text-lg font-bold tracking-tight">No audio yet</div>
        <div className="max-w-sm text-sm text-muted">{media?.progress?.error ? `The last build failed: ${media.progress.error}` : completed ? 'Voice the debate to unlock the video and the Short.' : 'Audio is produced once the debate has finished.'}</div>
        {isOwner && completed && <Button onClick={onGenerate}>Generate audio</Button>}
      </div>
    );
  }

  const isLong = format === 'long';
  return (
    <div>
      <Segmented
        options={[
          { value: 'long' as const, label: 'YouTube 16:9' },
          { value: 'short' as const, label: 'Short 9:16' },
        ]}
        value={format}
        onChange={onFormat}
      />
      <div className="mt-3.5 flex justify-center overflow-hidden rounded-panel border border-line-2 bg-ink-2">
        <div className={`w-full ${isLong ? '' : 'max-w-[360px]'}`}>
          {isLong ? (
            <Player
              key="long"
              component={DebateLong}
              inputProps={{ timeline, mediaBase }}
              durationInFrames={longDurationInFrames(timeline)}
              fps={FPS}
              compositionWidth={LONG_W}
              compositionHeight={LONG_H}
              controls
              acknowledgeRemotionLicense
              initialFrame={15}
              style={{ width: '100%' }}
            />
          ) : (
            <Player
              key={`short-${highlightIndex}`}
              component={DebateShort}
              inputProps={{ timeline, mediaBase, highlightIndex }}
              durationInFrames={shortDurationInFrames(timeline, highlightIndex)}
              fps={FPS}
              compositionWidth={SHORT_W}
              compositionHeight={SHORT_H}
              controls
              acknowledgeRemotionLicense
              initialFrame={15}
              style={{ width: '100%' }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
