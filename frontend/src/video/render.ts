import { canRenderMediaOnWeb, renderMediaOnWeb, type CanRenderMediaOnWebResult, type RenderMediaOnWebProgress } from '@remotion/web-renderer';
import type { ComponentType } from 'react';
import { FPS } from './constants';

export interface RenderJob<P extends Record<string, unknown>> {
  id: string;
  component: ComponentType<P>;
  inputProps: P;
  width: number;
  height: number;
  durationInFrames: number;
  muted: boolean;
  scale: number; // 1 = full resolution, 0.667 = 720p from 1080p
  onProgress: (p: RenderMediaOnWebProgress) => void;
  signal: AbortSignal;
}

export const checkRenderSupport = (width: number, height: number, muted: boolean): Promise<CanRenderMediaOnWebResult> =>
  canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', audioCodec: 'aac', width, height, muted });

/** Encode the composition to an MP4 in the browser (WebCodecs). */
export const renderMp4 = async <P extends Record<string, unknown>>(job: RenderJob<P>): Promise<{ blob: Blob; ms: number }> => {
  const t0 = performance.now();
  const { getBlob } = await renderMediaOnWeb({
    composition: { id: job.id, component: job.component, width: job.width, height: job.height, fps: FPS, durationInFrames: job.durationInFrames, defaultProps: job.inputProps },
    inputProps: job.inputProps,
    container: 'mp4',
    videoCodec: 'h264',
    audioCodec: 'aac',
    videoBitrate: 'high',
    audioBitrate: 'high',
    muted: job.muted,
    scale: job.scale,
    onProgress: job.onProgress,
    signal: job.signal,
    delayRenderTimeoutInMilliseconds: 60_000,
    logLevel: 'warn',
    licenseKey: 'free-license',
  });
  const blob = await getBlob();
  return { blob, ms: performance.now() - t0 };
};
