import { api } from './client';
import type { Timeline } from './timeline';
import type {
  DebateMedia,
  GenerateMediaRequest,
  MediaCapabilities,
  TTSProviderName,
  VoicesResponse,
} from './types';

export const getMediaCapabilities = () =>
  api.get<MediaCapabilities>('/media/capabilities').then((r) => r.data);

export const getVoices = (provider: TTSProviderName, debateId: string, ttsKey?: string) =>
  api
    .get<VoicesResponse>('/media/voices', {
      params: { provider, debate_id: debateId },
      headers: ttsKey ? { 'X-TTS-Key': ttsKey } : undefined,
    })
    .then((r) => r.data);

export const getDebateMedia = (debateId: string) =>
  api.get<DebateMedia>(`/debates/${debateId}/media`).then((r) => r.data);

export const generateMedia = (debateId: string, body: GenerateMediaRequest) =>
  api.post<{ debate_id: string; media_status: string; message: string }>(`/debates/${debateId}/media`, body).then((r) => r.data);

export const deleteMedia = (debateId: string) => api.delete(`/debates/${debateId}/media`);

/** timeline.json lives under /api/media/files, i.e. outside the axios baseURL. */
export const fetchTimeline = (url: string) => api.get<Timeline>(url, { baseURL: '' }).then((r) => r.data);

/** Absolute folder URL for the renderer (Remotion needs full URLs for audio). */
export const absoluteMediaBase = (base: string) => `${window.location.origin}${base}`;
