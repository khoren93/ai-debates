import { api } from './client';
import type { DebateDetail, GalleryResponse } from './types';

export const listGallery = (params: { category?: string; q?: string; limit?: number; offset?: number } = {}) =>
  api.get<GalleryResponse>('/gallery', { params }).then((r) => r.data);

export const getPublicDebate = (slug: string) =>
  api.get<DebateDetail>(`/gallery/${encodeURIComponent(slug)}`).then((r) => r.data);
