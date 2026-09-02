import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { fetchTimeline, getDebateMedia } from '../api/media';
import type { Timeline } from '../api/timeline';
import type { DebateMedia } from '../api/types';

const POLL_MS = 2500;

/** Media build state for a debate; polls while a build is queued/running and loads the timeline when ready. */
export const useDebateMedia = (debateId: string | undefined) => {
  const [media, setMedia] = useState<DebateMedia | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped to re-run the fetch effect (manual refresh and polling).
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!debateId) return;
    let cancelled = false;
    getDebateMedia(debateId)
      .then(async (data) => {
        if (cancelled) return;
        setMedia(data);
        setError(null);
        if (data.media_status === 'ready' && data.urls) {
          const tl = await fetchTimeline(data.urls.timeline);
          if (!cancelled) setTimeline(tl);
        } else {
          setTimeline(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [debateId, reloadKey]);

  const active = media?.media_status === 'queued' || media?.media_status === 'running';
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setReloadKey((k) => k + 1), POLL_MS);
    return () => window.clearInterval(timer);
  }, [active]);

  return { media, timeline, error, refresh, active };
};
