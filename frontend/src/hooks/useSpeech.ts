import { useCallback, useEffect, useRef, useState } from 'react';
import type { Participant, Turn } from '../api/types';

const stripMarkdown = (text: string) => text.replace(/[*#_`>]/g, '');

/** Browser text-to-speech for reading debate turns aloud. */
export function useSpeech(participants: Participant[]) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', load);
    load();
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, []);

  const voiceFor = useCallback(
    (turn: Pick<Turn, 'speaker_name' | 'speaker_role'>) => {
      if (voices.length === 0) return null;
      const participant = participants.find((p) => p.name === turn.speaker_name);
      if (participant?.voice_name) {
        const chosen = voices.find((v) => v.name === participant.voice_name);
        if (chosen) return chosen;
      }
      const moderatorVoice = voices.find((v) => v.name.includes('Google US English'));
      if (turn.speaker_role === 'moderator') return moderatorVoice ?? voices[0];

      const pool = voices.filter((v) => v !== moderatorVoice && v.lang.startsWith('en'));
      if (pool.length === 0) return voices[0];
      const hash = [...turn.speaker_name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return pool[hash % pool.length];
    },
    [voices, participants],
  );

  const speak = useCallback(
    (text: string, turn: Pick<Turn, 'speaker_name' | 'speaker_role'>) =>
      new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
        const voice = voiceFor(turn);
        if (voice) utterance.voice = voice;
        utterance.rate = 1.1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      }),
    [voiceFor],
  );

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const readTurns = useCallback(
    async (turns: Turn[], startIndex = 0) => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      speakingRef.current = true;
      setIsSpeaking(true);
      for (const turn of turns.slice(startIndex)) {
        if (!speakingRef.current) break;
        if (turn.error || !turn.text.trim()) continue;
        await speak(`${turn.speaker_name} says: ${turn.text}`, turn);
        await new Promise((r) => setTimeout(r, 400));
      }
      speakingRef.current = false;
      setIsSpeaking(false);
    },
    [speak],
  );

  return { voices, isSpeaking, readTurns, stop, supported: 'speechSynthesis' in window };
}
