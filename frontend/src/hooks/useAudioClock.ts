import { useEffect, useState } from 'react';

/** Current playback position of an <audio> element in ms, sampled with requestAnimationFrame. */
export const useAudioClock = (audio: HTMLAudioElement | null): number => {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!audio) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      const now = Math.round(audio.currentTime * 1000);
      if (now !== last) {
        last = now;
        setMs(now);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audio]);
  return ms;
};
