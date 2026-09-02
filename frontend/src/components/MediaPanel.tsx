import { Player } from '@remotion/player';
import { Clapperboard, Download, Headphones, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { absoluteMediaBase, deleteMedia, generateMedia, getMediaCapabilities, getVoices } from '../api/media';
import type { DebateDetail, MediaCapabilities, TTSProviderName, VoiceInfo } from '../api/types';
import { useAudioClock } from '../hooks/useAudioClock';
import { useDebateMedia } from '../hooks/useDebateMedia';
import { formatCost } from '../lib/format';
import { FPS, LONG_H, LONG_W, SHORT_H, SHORT_W } from '../video/constants';
import { DebateLong } from '../video/DebateLong';
import { DebateShort } from '../video/DebateShort';
import { longDurationInFrames, shortDurationInFrames } from '../video/utils';
import RenderPanel from './RenderPanel';

const MODEL_LABELS: Record<string, string> = {
  eleven_v3: 'eleven_v3 — most expressive, understands [emotion] tags',
  eleven_multilingual_v2: 'eleven_multilingual_v2 — stable, no tags',
  eleven_flash_v2_5: 'eleven_flash_v2_5 — cheap draft',
};

const formatMs = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

interface SpeakerRow {
  id: string;
  name: string;
  role: string;
}

const speakerRows = (debate: DebateDetail): SpeakerRow[] => [
  ...debate.participants.map((p, i) => ({ id: p.id || `participant_${i}`, name: p.name ?? `Speaker ${i + 1}`, role: p.role })),
  { id: 'judge', name: 'Judge (verdict)', role: 'judge' },
];

const sectionTitle = (icon: React.ReactNode, title: string, hint: string) => (
  <div className="flex items-baseline gap-3 mb-3">
    <h3 className="flex items-center text-base font-semibold text-gray-900">
      {icon}
      {title}
    </h3>
    <span className="text-xs text-gray-500">{hint}</span>
  </div>
);

/** Audio (server TTS) + video (browser render) for a finished debate. */
const MediaPanel = ({ debate }: { debate: DebateDetail }) => {
  const debateId = debate.id;
  const { media, timeline, error: mediaError, refresh, active } = useDebateMedia(debateId);
  const [caps, setCaps] = useState<MediaCapabilities | null>(null);
  const [providerChoice, setProviderChoice] = useState<TTSProviderName | null>(null);
  const [modelChoice, setModelChoice] = useState<string | null>(null);
  const [ttsKey, setTtsKey] = useState('');
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [force, setForce] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const clockMs = useAudioClock(audioEl);

  useEffect(() => {
    getMediaCapabilities().then(setCaps).catch(() => setCaps(null));
  }, []);

  const provider: TTSProviderName = providerChoice ?? media?.options?.provider ?? caps?.default_provider ?? 'edge';
  const modelId = modelChoice ?? media?.options?.model_id ?? caps?.default_model_id ?? 'eleven_v3';
  const rows = useMemo(() => speakerRows(debate), [debate]);
  const elevenKeyMissing = provider === 'elevenlabs' && !caps?.elevenlabs && !ttsKey;
  const usableVoices = elevenKeyMissing ? [] : voices;

  // Voice catalogue + defaults for the current provider.
  useEffect(() => {
    if (provider === 'elevenlabs' && !caps?.elevenlabs && !ttsKey) return;
    let cancelled = false;
    getVoices(provider, debateId, ttsKey || undefined)
      .then((r) => {
        if (cancelled) return;
        setVoicesError(null);
        setVoices(r.voices);
        setChosen((prev) => {
          const saved = media?.options?.provider === provider ? media.options.voices : {};
          const next: Record<string, string> = {};
          for (const [id, voice] of Object.entries(r.defaults)) {
            next[id] = (prev[id] && r.voices.some((v) => v.id === prev[id]) ? prev[id] : saved[id]) || voice;
          }
          return next;
        });
      })
      .catch((err) => {
        if (!cancelled) setVoicesError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
    // media?.options is only used to seed the initial choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, debateId, ttsKey, caps?.elevenlabs]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await generateMedia(debateId, { provider, model_id: provider === 'elevenlabs' ? modelId : 'edge', voices: chosen, force, user_tts_key: ttsKey || undefined });
      refresh();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete the generated audio for this debate?')) return;
    try {
      await deleteMedia(debateId);
      refresh();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const previewVoice = (voice: VoiceInfo) => {
    if (!voice.preview_url) return;
    const el = new window.Audio(voice.preview_url);
    void el.play();
  };

  const status = media?.media_status ?? 'none';
  const progress = media?.progress;
  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : status === 'ready' ? 100 : 0;
  const base = media?.urls ? absoluteMediaBase(media.urls.base) : '';
  const longProps = useMemo(() => (timeline && base ? { timeline, mediaBase: base } : null), [timeline, base]);
  const shortProps = useMemo(() => (timeline && base ? { timeline, mediaBase: base, highlightIndex } : null), [timeline, base, highlightIndex]);
  const activeSeg = timeline ? timeline.segments.findIndex((s) => clockMs >= s.start_ms && clockMs < s.end_ms + timeline.gap_ms) : -1;
  const charCount = debate.turns.reduce((acc, t) => acc + (t.error ? 0 : t.text.length), 0);

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white p-5 space-y-8">
      <section>
        {sectionTitle(<Headphones className="w-4 h-4 mr-2 text-blue-600" />, 'Audio', 'neural voices per speaker, word timestamps, mixed track')}
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm text-gray-700">
            <span className="block text-xs text-gray-500 mb-1">Provider</span>
            <select value={provider} onChange={(e) => setProviderChoice(e.target.value as TTSProviderName)} disabled={active} className="h-9 border border-gray-300 rounded px-2 text-sm">
              <option value="elevenlabs">ElevenLabs {caps && !caps.elevenlabs ? '(needs your key)' : ''}</option>
              <option value="edge">Edge neural (free fallback)</option>
            </select>
          </label>
          {provider === 'elevenlabs' && (
            <label className="text-sm text-gray-700">
              <span className="block text-xs text-gray-500 mb-1">Model</span>
              <select value={modelId} onChange={(e) => setModelChoice(e.target.value)} disabled={active} className="h-9 border border-gray-300 rounded px-2 text-sm">
                {(caps?.elevenlabs_models ?? Object.keys(MODEL_LABELS)).map((m) => (
                  <option key={m} value={m}>{MODEL_LABELS[m] ?? m}</option>
                ))}
              </select>
            </label>
          )}
          {provider === 'elevenlabs' && (
            <label className="text-sm text-gray-700">
              <span className="block text-xs text-gray-500 mb-1">Your ElevenLabs key {caps?.elevenlabs ? '(optional)' : '(required)'}</span>
              <input type="password" value={ttsKey} onChange={(e) => setTtsKey(e.target.value.trim())} placeholder="xi-…" disabled={active} className="h-9 border border-gray-300 rounded px-2 text-sm w-56" />
            </label>
          )}
        </div>

        {elevenKeyMissing && <p className="mt-2 text-sm text-amber-700">No system ElevenLabs key is configured. Enter your own key or switch to the free Edge voices.</p>}
        {voicesError && <p className="mt-2 text-sm text-red-700">{voicesError}</p>}

        {!elevenKeyMissing && (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {rows.map((row) => {
              const voice = usableVoices.find((v) => v.id === chosen[row.id]);
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-sm font-medium text-gray-800 truncate" title={row.name}>
                    {row.name}
                  </span>
                  <select value={chosen[row.id] ?? ''} onChange={(e) => setChosen({ ...chosen, [row.id]: e.target.value })} disabled={active || usableVoices.length === 0} className="h-9 flex-1 min-w-0 border border-gray-300 rounded px-2 text-sm">
                    {usableVoices.length === 0 && <option value="">loading voices…</option>}
                    {usableVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.description ? ` — ${v.description}` : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => voice && previewVoice(voice)} disabled={!voice?.preview_url} title="Voice sample" className="p-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || active || elevenKeyMissing || usableVoices.length === 0}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm disabled:opacity-50"
          >
            {status === 'ready' ? <RefreshCw className="w-4 h-4 mr-2" /> : <Headphones className="w-4 h-4 mr-2" />}
            {active ? 'Generating…' : status === 'ready' ? 'Regenerate audio' : 'Generate audio'}
          </button>
          {status === 'ready' && (
            <label className="text-sm text-gray-600 flex items-center gap-2">
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> ignore cached turns
            </label>
          )}
          <span className="text-xs text-gray-500">
            ~{charCount.toLocaleString()} characters
            {provider === 'elevenlabs' && ` · ElevenLabs ≈ ${formatCost((charCount / 1000) * (modelId === 'eleven_flash_v2_5' ? 0.05 : 0.1))}`}
            {provider === 'edge' && ' · Edge voices are free but not the quality we aim for'}
          </span>
          {status === 'ready' && !active && (
            <button type="button" onClick={remove} className="flex items-center text-sm text-red-600 hover:underline">
              <Trash2 className="w-4 h-4 mr-1" /> Delete audio
            </button>
          )}
        </div>

        {(active || status === 'error') && progress && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className={`h-full transition-all ${status === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {progress.message}
              {active && progress.total > 0 && ` (${progress.current}/${progress.total})`}
            </div>
          </div>
        )}
        {status === 'error' && progress?.error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{progress.error}</div>}
        {(submitError || mediaError) && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{submitError ?? mediaError}</div>}

        {status === 'ready' && media?.urls && timeline && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
              <span>Duration: <b>{formatMs(timeline.total_ms)}</b></span>
              <span>Turns: <b>{timeline.segments.length}</b></span>
              <span>Voice: <b>{timeline.provider} / {timeline.model_id}</b></span>
              {media.stats?.estimated_usd != null && <span>Estimated cost: <b>${media.stats.estimated_usd}</b></span>}
              {media.stats && media.stats.cached_turns > 0 && <span>From cache: <b>{media.stats.cached_turns}</b></span>}
              <a href={media.urls.full_mp3} download={`debate-${debateId}.mp3`} className="inline-flex items-center text-blue-600 hover:underline">
                <Download className="w-4 h-4 mr-1" /> mp3
              </a>
            </div>
            <audio ref={setAudioEl} controls src={media.urls.full_mp3} className="w-full" />
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {timeline.segments.map((seg, i) => {
                const speaker = timeline.speakers.find((s) => s.id === seg.speaker_id);
                const rel = clockMs - seg.start_ms;
                return (
                  <div key={seg.seq_index} className={`rounded-lg border p-3 text-sm ${i === activeSeg ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-2 mb-1 text-xs text-gray-500">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: speaker?.color ?? '#999' }} />
                      <b className="text-gray-800">{seg.speaker_name}</b>
                      <span>
                        {formatMs(seg.start_ms)}–{formatMs(seg.end_ms)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (audioEl) {
                            audioEl.currentTime = seg.start_ms / 1000;
                            void audioEl.play();
                          }
                        }}
                        className="inline-flex items-center text-blue-600 hover:underline"
                      >
                        <Play className="w-3 h-3 mr-1 fill-current" /> play from here
                      </button>
                      {seg.note && <span className="text-gray-400 truncate">· {seg.note}</span>}
                    </div>
                    <p className="leading-relaxed">
                      {seg.words.map((w, j) => (
                        <span key={j} className={rel >= w.s && rel < w.e ? 'bg-blue-600 text-white rounded px-0.5' : rel >= w.e ? 'text-gray-900' : 'text-gray-400'}>
                          {w.w}{' '}
                        </span>
                      ))}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {longProps && timeline && (
        <section>
          {sectionTitle(<Clapperboard className="w-4 h-4 mr-2 text-blue-600" />, 'Video (16:9)', 'live preview; the MP4 is rendered in your browser')}
          <div className="rounded-lg overflow-hidden border border-gray-200 bg-black mb-3">
            <Player component={DebateLong} inputProps={longProps} durationInFrames={longDurationInFrames(timeline)} fps={FPS} compositionWidth={LONG_W} compositionHeight={LONG_H} controls acknowledgeRemotionLicense initialFrame={15} style={{ width: '100%' }} />
          </div>
          <RenderPanel id="DebateLong" component={DebateLong} inputProps={longProps} width={LONG_W} height={LONG_H} durationInFrames={longDurationInFrames(timeline)} label="Render MP4" fileName={`debate-${debateId}.mp4`} />
        </section>
      )}

      {shortProps && timeline && (
        <section>
          {sectionTitle(<Clapperboard className="w-4 h-4 mr-2 text-blue-600" />, 'Short (9:16)', 'a highlight with a hook, big captions and an end card')}
          {timeline.highlights.length > 1 && (
            <label className="text-sm text-gray-700 block mb-3">
              <span className="block text-xs text-gray-500 mb-1">Moment</span>
              <select value={highlightIndex} onChange={(e) => setHighlightIndex(Number(e.target.value))} className="h-9 border border-gray-300 rounded px-2 text-sm">
                {timeline.highlights.map((h) => (
                  <option key={h.index} value={h.index}>
                    {h.title} ({Math.round((h.end_ms - h.start_ms) / 1000)}s)
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-4 md:grid-cols-[minmax(0,340px)_1fr]">
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-black">
              <Player component={DebateShort} inputProps={shortProps} durationInFrames={shortDurationInFrames(timeline, highlightIndex)} fps={FPS} compositionWidth={SHORT_W} compositionHeight={SHORT_H} controls acknowledgeRemotionLicense initialFrame={15} style={{ width: '100%' }} />
            </div>
            <RenderPanel id={`DebateShort${highlightIndex}`} component={DebateShort} inputProps={shortProps} width={SHORT_W} height={SHORT_H} durationInFrames={shortDurationInFrames(timeline, highlightIndex)} label="Render short MP4" fileName={`debate-${debateId}-short-${highlightIndex + 1}.mp4`} vertical />
          </div>
        </section>
      )}
    </div>
  );
};

export default MediaPanel;
