import { api } from './client';
import type { CreateDebateResponse, DebateConfig, DebateDetail, DebateSummary } from './types';

export const listDebates = (limit = 50) =>
  api.get<DebateSummary[]>('/debates', { params: { limit } }).then((r) => r.data);

export const getDebate = (id: string) =>
  api.get<DebateDetail>(`/debates/${id}`).then((r) => r.data);

export const createDebate = (config: DebateConfig) =>
  api.post<CreateDebateResponse>('/debates', config).then((r) => r.data);

export const stopDebate = (id: string) =>
  api.post<{ debate_id: string; status: string }>(`/debates/${id}/stop`).then((r) => r.data);

export const deleteDebate = (id: string) => api.delete(`/debates/${id}`);

export const debateStreamUrl = (id: string) => `${api.defaults.baseURL}/debates/${id}/stream`;
