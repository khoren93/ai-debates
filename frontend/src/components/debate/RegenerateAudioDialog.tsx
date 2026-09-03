import { Play, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage, getErrorStatus } from '../../api/client';
import { deleteMedia, generateMedia, getMediaCapabilities, getVoices } from '../../api/media';
import type { DebateDetail, DebateMedia, MediaCapabilities, TTSProviderName, VoiceInfo } from '../../api/types';
import { useBillingConfig } from '../../hooks/useBillingConfig';
import { formatCost } from '../../lib/format';
import { Button, ConfirmDialog, ErrorBox, Hint, Input, Label, Modal, Select, useToast } from '../ui';

const MODEL_LABELS: Record<string, string> = {
  eleven_v3: 'eleven_v3 — most expressive, understands [emotion] tags',
  eleven_multilingual_v2: 'eleven_multilingual_v2 — stable, no tags',
  eleven_flash_v2_5: 'eleven_flash_v2_5 — cheap draft',
};

interface Props {
  open: boolean;
  onClose: () => void;
  debate: DebateDetail;
  media: DebateMedia | null;
  onQueued: () => void;
}

interface SpeakerRow {
  id: string;
  name: string;
}

/** Choose the voice engine and a voice per speaker, then queue the audio build. */
export const RegenerateAudioDialog = ({ open, onClose, debate, media, onQueued }: Props) => {
  const toast = useToast();
  const { config: billing } = useBillingConfig();
  const [caps, setCaps] = useState<MediaCapabilities | null>(null);
  const [providerChoice, setProviderChoice] = useState<TTSProviderName | null>(null);
  const [modelChoice, setModelChoice] = useState<string | null>(null);
  const [ttsKey, setTtsKey] = useState('');
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [force, setForce] = useState(false);
  const [submitError, setSubmitError] = useState<{ status: number | null; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getMediaCapabilities()
      .then((c) => {
        if (!cancelled) setCaps(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const plannedProvider = debate.media_plan?.provider;
  const provider: TTSProviderName = providerChoice ?? media?.options?.provider ?? (plannedProvider === 'elevenlabs' && caps?.elevenlabs ? 'elevenlabs' : caps?.default_provider ?? 'edge');
  const modelId = modelChoice ?? media?.options?.model_id ?? debate.media_plan?.model_id ?? caps?.default_model_id ?? 'eleven_v3';
  const rows = useMemo<SpeakerRow[]>(
    () => [...debate.participants.map((p, i) => ({ id: p.id || `participant_${i}`, name: p.name ?? `Speaker ${i + 1}` })), { id: 'judge', name: 'Judge (verdict)' }],
    [debate.participants],
  );
  const keyMissing = provider === 'elevenlabs' && !caps?.elevenlabs && !ttsKey;
  const savedVoices = media?.options?.provider === provider ? media.options.voices : debate.media_plan?.provider === provider ? debate.media_plan.voices : {};
  const savedKey = JSON.stringify(savedVoices);

  useEffect(() => {
    if (!open || keyMissing) return;
    let cancelled = false;
    getVoices(provider, { debateId: debate.id }, ttsKey || undefined)
      .then((r) => {
        if (cancelled) return;
        const saved = JSON.parse(savedKey) as Record<string, string>;
        setVoicesError(null);
        setVoices(r.voices);
        setChosen((prev) => {
          const next: Record<string, string> = {};
          for (const [id, voice] of Object.entries(r.defaults)) {
            const keep = prev[id] && r.voices.some((v) => v.id === prev[id]) ? prev[id] : saved[id] && r.voices.some((v) => v.id === saved[id]) ? saved[id] : voice;
            next[id] = keep;
          }
          return next;
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setVoicesError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, provider, debate.id, ttsKey, keyMissing, savedKey]);

  const chars = debate.turns.reduce((acc, t) => acc + (t.error ? 0 : t.text.length), 0);
  const premiumCost = (chars / 1000) * billing.tts_price_per_1k_chars;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await generateMedia(debate.id, { provider, model_id: provider === 'elevenlabs' ? modelId : 'edge', voices: chosen, force, user_tts_key: ttsKey || undefined });
      toast.success('Audio build queued');
      onQueued();
      onClose();
    } catch (err) {
      setSubmitError({ status: getErrorStatus(err), message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteMedia(debate.id);
      toast.info('Audio deleted');
      setConfirmDelete(false);
      onQueued();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const preview = (voice: VoiceInfo | undefined) => {
    if (!voice?.preview_url) return;
    void new Audio(voice.preview_url).play();
  };

  const ready = media?.media_status === 'ready';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={ready ? 'Regenerate audio' : 'Generate audio'}
        width="lg"
        footer={
          <>
            {ready && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="size-3.5" />} className="mr-auto">
                Delete audio
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={submitting} disabled={keyMissing || voices.length === 0}>
              {ready ? 'Regenerate' : 'Generate'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Voice engine</Label>
              <Select value={provider} onChange={(e) => setProviderChoice(e.target.value as TTSProviderName)} className="mt-1.5">
                <option value="edge">Edge neural — free</option>
                <option value="elevenlabs">Premium neural (ElevenLabs){caps && !caps.elevenlabs ? ' — needs your key' : ''}</option>
              </Select>
            </div>
            {provider === 'elevenlabs' && (
              <div>
                <Label>Model</Label>
                <Select value={modelId} onChange={(e) => setModelChoice(e.target.value)} className="mt-1.5">
                  {(caps?.elevenlabs_models ?? Object.keys(MODEL_LABELS)).map((m) => (
                    <option key={m} value={m}>
                      {MODEL_LABELS[m] ?? m}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          {provider === 'elevenlabs' && (
            <div>
              <Label hint={caps?.elevenlabs ? '(optional — otherwise billed to credits)' : '(required)'}>Your ElevenLabs key</Label>
              <Input type="password" value={ttsKey} onChange={(e) => setTtsKey(e.target.value.trim())} placeholder="xi-…" className="mt-1.5 font-mono" />
              {keyMissing && <Hint tone="danger">No premium key is configured on this server. Enter your own key or switch to the free Edge voices.</Hint>}
            </div>
          )}
          {voicesError && <ErrorBox>{voicesError}</ErrorBox>}
          {!keyMissing && (
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((row) => {
                const voice = voices.find((v) => v.id === chosen[row.id]);
                return (
                  <div key={row.id} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-sm font-medium" title={row.name}>
                      {row.name}
                    </span>
                    <Select value={chosen[row.id] ?? ''} onChange={(e) => setChosen({ ...chosen, [row.id]: e.target.value })} disabled={voices.length === 0} className="min-w-0 flex-1 !py-2 text-[13px]">
                      {voices.length === 0 && <option value="">loading voices…</option>}
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.description ? ` — ${v.description}` : ''}
                        </option>
                      ))}
                    </Select>
                    <button type="button" onClick={() => preview(voice)} disabled={!voice?.preview_url} title="Voice sample" className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-line-2 bg-surface-2 text-text disabled:opacity-40 cursor-pointer">
                      <Play className="size-3 fill-current" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            <span>
              ~{chars.toLocaleString()} characters ·{' '}
              {provider === 'elevenlabs' ? (ttsKey ? 'billed to your ElevenLabs account' : `≈ ${formatCost(premiumCost)} in credits`) : 'free'}
            </span>
            {ready && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> ignore cached turns
              </label>
            )}
          </div>
          {submitError && (
            <ErrorBox>
              {submitError.message}
              {submitError.status === 402 && (
                <div className="mt-2">
                  <Link to="/account" className="font-semibold text-accent hover:text-accent-hover">
                    Top up credits →
                  </Link>
                </div>
              )}
            </ErrorBox>
          )}
        </div>
      </Modal>
      <ConfirmDialog open={confirmDelete} title="Delete the generated audio?" body="The mixed track, the timeline and the cached turns are removed. You can generate them again later." confirmLabel="Delete audio" danger busy={deleting} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </>
  );
};
