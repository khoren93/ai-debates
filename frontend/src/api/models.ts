import { api } from './client';
import type { CreditsResponse, ModelInfo, ModelsResponse, ValidationResult } from './types';

export const listModels = () => api.get<ModelsResponse>('/models').then((r) => r.data.data);

export const getCredits = (apiKey?: string) =>
  api
    .get<CreditsResponse>('/models/credits', {
      headers: apiKey ? { 'X-OpenRouter-Key': apiKey } : undefined,
    })
    .then((r) => r.data);

export const validateModels = (modelIds: string[], apiKey?: string) =>
  api
    .post<{ results: ValidationResult[] }>('/models/validate', {
      model_ids: modelIds,
      api_key: apiKey,
    })
    .then((r) => r.data.results);

export type { ModelInfo };
