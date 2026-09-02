import type { RenderMediaOnWebProgress } from '@remotion/web-renderer';
import { Download, Square, Video } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { checkRenderSupport, renderMp4 } from '../video/render';

interface Props<P extends Record<string, unknown>> {
  id: string;
  component: ComponentType<P>;
  inputProps: P;
  width: number;
  height: number;
  durationInFrames: number;
  label: string;
  fileName: string;
  vertical?: boolean;
}

const formatBytes = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

/** "Render MP4" button: encodes the composition in the visitor's browser and offers the file. */
const RenderPanel = <P extends Record<string, unknown>>({ id, component, inputProps, width, height, durationInFrames, label, fileName, vertical }: Props<P>) => {
  const [support, setSupport] = useState<{ canRender: boolean; issues: string[] } | null>(null);
  const [scale, setScale] = useState(1);
  const [progress, setProgress] = useState<RenderMediaOnWebProgress | null>(null);
  const [result, setResult] = useState<{ url: string; size: number; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkRenderSupport(width, height, false)
      .then((r) => {
        if (!cancelled) setSupport({ canRender: r.canRender, issues: r.issues.map((i) => `${i.severity}: ${i.message}`) });
      })
      .catch((e: Error) => {
        if (!cancelled) setSupport({ canRender: false, issues: [e.message] });
      });
    return () => {
      cancelled = true;
    };
  }, [width, height]);

  const run = async () => {
    setBusy(true);
    setError(null);
    setProgress(null);
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { blob, ms } = await renderMp4({ id, component, inputProps, width, height, durationInFrames, muted: false, scale, onProgress: setProgress, signal: ctrl.signal });
      setResult({ url: URL.createObjectURL(blob), size: blob.size, ms });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pct = progress ? Math.round(progress.progress * 100) : 0;
  const seconds = Math.round(durationInFrames / 30);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={busy || support?.canRender === false}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm disabled:opacity-50"
        >
          <Video className="w-4 h-4 mr-2" />
          {busy ? 'Rendering…' : label}
        </button>
        {busy && (
          <button type="button" onClick={() => abortRef.current?.abort()} className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Square className="w-3 h-3 mr-2 fill-current" /> Cancel
          </button>
        )}
        <label className="text-sm text-gray-600 flex items-center gap-2">
          Quality
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))} disabled={busy} className="border border-gray-300 rounded px-2 py-1 text-sm">
            <option value={1}>{height}p</option>
            <option value={0.6667}>{Math.round(height * 0.6667)}p (faster)</option>
            <option value={0.5}>{Math.round(height * 0.5)}p (draft)</option>
          </select>
        </label>
        <span className="text-xs text-gray-500">{seconds}s · {durationInFrames} frames · rendered in your browser</span>
      </div>
      {support && !support.canRender && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          This browser cannot render video: {support.issues.join('; ')}. Use Chrome or Edge.
        </div>
      )}
      {(busy || progress) && (
        <div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {pct}% · {progress?.encodedFrames ?? 0}/{durationInFrames} frames
            {busy && progress && progress.renderEstimatedTime > 0 && ` · ~${Math.ceil(progress.renderEstimatedTime / 1000)}s left`}
            {busy && ' · keep this tab open'}
          </div>
        </div>
      )}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
      {result && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <span>
              Done in <b>{(result.ms / 1000).toFixed(1)}s</b> ({(durationInFrames / (result.ms / 1000)).toFixed(0)} fps)
            </span>
            <span>
              Size: <b>{formatBytes(result.size)}</b>
            </span>
            <a href={result.url} download={fileName} className="inline-flex items-center text-blue-600 hover:underline">
              <Download className="w-4 h-4 mr-1" /> Download {fileName}
            </a>
          </div>
          <video controls src={result.url} className={`rounded-lg bg-black w-full ${vertical ? 'max-w-sm' : ''}`} />
        </div>
      )}
    </div>
  );
};

export default RenderPanel;
