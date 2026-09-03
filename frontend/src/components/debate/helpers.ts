import type { Timeline } from '../../api/timeline';
import type { Participant, Turn } from '../../api/types';
import { JUDGE_COLOR, speakerColor, speakerColorByName } from '../../lib/format';
import type { TimelineItem } from './TurnTimeline';

/** Colour for a turn: by speaker id when present, otherwise by name (older debates). */
export const turnColor = (turn: Pick<Turn, 'speaker_id' | 'speaker_name' | 'turn_type'>, participants: Participant[]) => {
  if (turn.turn_type === 'verdict' || turn.speaker_id === 'judge') return JUDGE_COLOR;
  if (turn.speaker_id) return speakerColor(turn.speaker_id, participants);
  return speakerColorByName(turn.speaker_name, participants);
};

/** H / D1 / D2 / J labels for the timeline bar. */
export const speakerLabel = (speakerId: string | undefined, participants: Participant[]) => {
  if (!speakerId || speakerId === 'judge') return 'J';
  const idx = participants.findIndex((p, i) => (p.id ?? `participant_${i}`) === speakerId);
  if (idx < 0) return '?';
  if (participants[idx].role === 'moderator') return 'H';
  const debaterIndex = participants.slice(0, idx).filter((p) => p.role !== 'moderator').length;
  return `D${debaterIndex + 1}`;
};

/** Timeline bar items: from the audio timeline when ready, else from the turns (by length). */
export const timelineItems = (turns: Turn[], participants: Participant[], timeline: Timeline | null): TimelineItem[] => {
  if (timeline && timeline.segments.length > 0) {
    return timeline.segments.map((seg) => ({
      key: seg.seq_index,
      label: speakerLabel(seg.speaker_id, participants),
      color: timeline.speakers.find((s) => s.id === seg.speaker_id)?.color ?? speakerColor(seg.speaker_id, participants),
      flex: Math.max(1, (seg.end_ms - seg.start_ms) / 1000),
      title: `${seg.speaker_name} · ${msLabel(seg.start_ms)}`,
    }));
  }
  return turns
    .filter((t) => !t.error)
    .map((t) => ({
      key: t.seq_index,
      label: speakerLabel(t.speaker_id, participants),
      color: turnColor(t, participants),
      flex: Math.max(1, t.text.split(/\s+/).length / 20),
      title: t.speaker_name,
    }));
};

export const msLabel = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** "en-GB-SoniaNeural" -> "Sonia"; opaque provider ids are hidden. */
export const prettyVoice = (voiceId: string | null | undefined): string | null => {
  if (!voiceId) return null;
  const edge = voiceId.match(/^[a-z]{2,3}-[A-Za-z]{2,4}-([A-Za-z]+?)(?:Multilingual)?Neural$/);
  if (edge) return edge[1];
  if (/^[A-Za-z0-9]{16,}$/.test(voiceId)) return null;
  return voiceId;
};

/** Markdown export of a debate. */
export const debateMarkdown = (title: string, createdAt: string, status: string, participants: Participant[], turns: Turn[]) => {
  const lines: string[] = [
    `# ${title}`,
    `Date: ${new Date(createdAt).toLocaleString()}`,
    `Status: ${status}`,
    '',
    '## Participants',
    ...participants.map((p) => `- ${p.role}: ${p.name} (${p.model})`),
    '',
    '---',
    '',
  ];
  for (const turn of turns) {
    lines.push(`### ${turn.speaker_name}`, '', turn.error ? `_Error: ${turn.error}_` : turn.text, '');
  }
  return lines.join('\n');
};

export const downloadText = (text: string, fileName: string, type = 'text/markdown') => {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};
