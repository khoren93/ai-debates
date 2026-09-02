export type DebateStatus = 'queued' | 'running' | 'completed' | 'error' | 'stopped';
export type ParticipantRole = 'moderator' | 'debater';
export type LengthPreset = 'very_short' | 'short' | 'medium' | 'long';

export const ACTIVE_STATUSES: readonly DebateStatus[] = ['queued', 'running'];

export interface ModelInfo {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  is_free: boolean;
}

export interface ModelsResponse {
  data: ModelInfo[];
  timestamp: number;
}

export interface CreditsResponse {
  credits: number | null;
  error: string | null;
}

export interface ValidationResult {
  model_id: string;
  status: 'ok' | 'error';
  error: string | null;
}

export interface TurnUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
}

export interface DebateTotals {
  tokens_in: number;
  tokens_out: number;
  cost: number;
  turns_count: number;
}

export interface Turn {
  seq_index: number;
  round_id: string;
  turn_type: string;
  speaker_role: ParticipantRole;
  speaker_id?: string; // "participant_{i}" | "judge"
  speaker_name: string;
  text: string;
  error: string | null;
  model_used: string;
  usage: TurnUsage;
  created_at: string | null;
}

export interface Participant {
  id?: string; // "participant_{i}", matches Turn.speaker_id
  name: string | null;
  role: ParticipantRole | string;
  model: string;
  voice_name: string | null;
  avatar: string | null;
}

export interface DebateSummary {
  id: string;
  title: string | null;
  status: DebateStatus;
  media_status?: MediaStatus;
  created_at: string;
  totals: DebateTotals;
}

export interface DebateSettings {
  topic: string;
  description: string | null;
  language: string;
  language_code?: string;
  num_rounds: number;
  length_preset: string;
  intensity: number;
  output_style?: OutputStyle;
}

export interface DebateDetail {
  id: string;
  status: DebateStatus;
  media_status?: MediaStatus;
  title: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  settings: DebateSettings;
  totals: DebateTotals;
  participants: Participant[];
  turns: Turn[];
}

export interface ParticipantConfig {
  role: ParticipantRole;
  model_id: string;
  display_name: string;
  avatar_url?: string;
  voice_name?: string;
  persona_preset?: string;
  persona_custom?: string;
}

export interface DebateConfig {
  topic: string;
  description?: string;
  language: string;
  participants: ParticipantConfig[];
  debate_preset_id?: string;
  length_preset: LengthPreset | string;
  num_rounds: number;
  intensity?: number;
  output_style?: OutputStyle;
  user_provider_key?: string;
}

export interface CreateDebateResponse {
  debate_id: string;
  status: string;
  message: string;
}

// --- Server-Sent Events -----------------------------------------------------

export interface TurnStartedEvent {
  seq_index: number;
  speaker_name: string;
  speaker_role: ParticipantRole;
  turn_type: string;
  round_id: string;
}

export interface TurnDeltaEvent {
  seq_index: number;
  delta: string;
  speaker_name?: string;
}

export interface DebateTerminalEvent {
  debate_id: string;
  status?: DebateStatus;
  message?: string;
  totals?: DebateTotals;
}

// --- Media (audio + browser-side video) --------------------------------------

export type OutputStyle = 'markdown' | 'spoken';
export type MediaStatus = 'none' | 'queued' | 'running' | 'ready' | 'error';
export type TTSProviderName = 'elevenlabs' | 'edge';

export interface MediaOptions {
  provider: TTSProviderName;
  model_id: string;
  voices: Record<string, string>; // speaker id -> provider voice id
}

export interface GenerateMediaRequest extends MediaOptions {
  force?: boolean;
  user_tts_key?: string;
}

export interface MediaProgress {
  step: string;
  current: number;
  total: number;
  message: string;
  error: string | null;
}

export interface MediaUrls {
  timeline: string;
  full_mp3: string;
  full_wav: string;
  base: string;
}

export interface MediaStats {
  chars: number;
  tts_ms: number;
  estimated_usd: number | null;
  total_ms: number;
  cached_turns: number;
}

export interface DebateMedia {
  debate_id: string;
  media_status: MediaStatus;
  progress: MediaProgress;
  options: MediaOptions | null;
  urls: MediaUrls | null;
  stats: MediaStats | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface VoiceInfo {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  gender: string | null;
  languages: string[];
}

export interface VoicesResponse {
  provider: TTSProviderName;
  voices: VoiceInfo[];
  defaults: Record<string, string>;
}

export interface MediaCapabilities {
  elevenlabs: boolean;
  edge: boolean;
  ffmpeg: boolean;
  default_provider: TTSProviderName;
  default_model_id: string;
  elevenlabs_models: string[];
  rate_limit_per_day: number;
}
