import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Coins, Download, Square, Volume2 } from 'lucide-react';
import { getDebate, stopDebate } from '../api/debates';
import { getErrorMessage } from '../api/client';
import { ACTIVE_STATUSES, type DebateDetail, type Turn, type TurnStartedEvent } from '../api/types';
import { useDebateStream } from '../hooks/useDebateStream';
import { useSpeech } from '../hooks/useSpeech';
import { formatCost, formatTokens } from '../lib/format';
import MediaPanel from '../components/MediaPanel';
import ParticipantsBar from '../components/ParticipantsBar';
import RoundDivider from '../components/RoundDivider';
import StatusBadge from '../components/StatusBadge';
import TurnBubble from '../components/TurnBubble';

interface StreamingTurn extends TurnStartedEvent {
  text: string;
}

const EMPTY_PARTICIPANTS: DebateDetail['participants'] = [];

const insertTurn = (turns: Turn[], turn: Turn) => {
  if (turns.some((t) => t.seq_index === turn.seq_index)) return turns;
  return [...turns, turn].sort((a, b) => a.seq_index - b.seq_index);
};

const isNearBottom = () =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;

const DebateLive = () => {
  const { id } = useParams<{ id: string }>();
  const [debate, setDebate] = useState<DebateDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<StreamingTurn | null>(null);
  const [stopping, setStopping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const participants = debate?.participants ?? EMPTY_PARTICIPANTS;
  const { isSpeaking, readTurns, stop: stopSpeech, supported: speechSupported } = useSpeech(participants);

  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getDebate(id);
      setDebate(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getDebate(id)
      .then((data) => {
        if (cancelled) return;
        setDebate(data);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isActive = !!debate && ACTIVE_STATUSES.includes(debate.status);

  useDebateStream(id, isActive, {
    onDebateStarted: () => setDebate((d) => (d ? { ...d, status: 'running' } : d)),
    onTurnStarted: (e) => setStreaming({ ...e, text: '' }),
    onTurnDelta: (e) =>
      setStreaming((prev) =>
        prev && prev.seq_index === e.seq_index
          ? { ...prev, text: prev.text + e.delta }
          : {
              seq_index: e.seq_index,
              speaker_name: e.speaker_name ?? 'Speaker',
              speaker_role: 'debater',
              turn_type: 'argument',
              round_id: '',
              text: e.delta,
            },
      ),
    onTurnCompleted: (turn) => {
      setDebate((d) => (d ? { ...d, turns: insertTurn(d.turns, turn) } : d));
      setStreaming(null);
    },
    onTurnError: (turn) => {
      setDebate((d) => (d ? { ...d, turns: insertTurn(d.turns, turn) } : d));
      setStreaming(null);
    },
    onDebateCompleted: () => {
      setStreaming(null);
      void refetch();
    },
    onDebateError: (e) => {
      setStreaming(null);
      setDebate((d) => (d ? { ...d, status: 'error', error_message: e.message ?? d.error_message } : d));
      void refetch();
    },
    onDebateStopped: () => {
      setStreaming(null);
      setDebate((d) => (d ? { ...d, status: 'stopped' } : d));
      // The worker saves the partial turn shortly after the stop is acknowledged.
      setTimeout(() => void refetch(), 3000);
    },
    onReconnect: () => void refetch(),
  });

  // Auto-scroll: always on a new turn, only when near the bottom while streaming.
  const turnCount = debate?.turns.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turnCount]);
  const streamingLength = streaming?.text.length ?? 0;
  useEffect(() => {
    if (streamingLength > 0 && isNearBottom()) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [streamingLength]);

  const handleStop = async () => {
    if (!id || !window.confirm('Stop this debate? The current turn will be cut short.')) return;
    setStopping(true);
    try {
      await stopDebate(id);
    } catch (err) {
      alert(`Failed to stop debate: ${getErrorMessage(err)}`);
    } finally {
      setStopping(false);
    }
  };

  const handleDownload = () => {
    if (!debate) return;
    const lines: string[] = [
      `# ${debate.title ?? 'Debate'}`,
      `Date: ${new Date(debate.created_at).toLocaleString()}`,
      `Status: ${debate.status}`,
      '',
      '## Participants',
      ...debate.participants.map((p) => `- ${p.role}: ${p.name} (${p.model})`),
      '',
      '---',
      '',
    ];
    for (const turn of debate.turns) {
      lines.push(`### ${turn.speaker_name}`, '', turn.error ? `_Error: ${turn.error}_` : turn.text, '');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate-${debate.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadError && !debate) {
    return (
      <div className="max-w-3xl mx-auto p-10 text-center">
        <p className="text-red-600 font-medium mb-4">{loadError}</p>
        <button onClick={() => void refetch()} className="text-blue-600 hover:underline mr-4">Retry</button>
        <Link to="/" className="text-gray-600 hover:underline">Back to home</Link>
      </div>
    );
  }
  if (!debate) return <div className="p-10 text-center text-gray-500">Loading debate…</div>;

  const totals = debate.totals;
  const hasTotals = totals.tokens_in + totals.tokens_out > 0;
  const lastRound = debate.turns.length > 0 ? debate.turns[debate.turns.length - 1].round_id : null;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <Link to="/" className="inline-flex items-center text-gray-600 mb-6 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </Link>

      <div className="mb-8 border-b pb-4 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold mb-2 break-words">{debate.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
            <StatusBadge status={debate.status} />
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" /> {new Date(debate.created_at).toLocaleString()}
            </span>
            {hasTotals && (
              <span className="flex items-center" title="Tokens in / out">
                <Coins className="w-4 h-4 mr-1" />
                {formatTokens(totals.tokens_in)} / {formatTokens(totals.tokens_out)} tokens
                {totals.cost > 0 && ` · ${formatCost(totals.cost)}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {isActive && (
            <button
              onClick={handleStop}
              disabled={stopping}
              className="flex items-center px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition text-sm font-medium shadow-sm disabled:opacity-50"
            >
              <Square className="w-4 h-4 mr-2 fill-current" />
              {stopping ? 'Stopping…' : 'Stop Debate'}
            </button>
          )}
          {speechSupported && (
            <button
              onClick={isSpeaking ? stopSpeech : () => void readTurns(debate.turns)}
              disabled={debate.turns.length === 0}
              className={`flex items-center px-4 py-2 border rounded-lg transition text-sm font-medium shadow-sm ${
                isSpeaking
                  ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                  : 'bg-white border-gray-300 hover:bg-gray-50 disabled:opacity-50'
              }`}
            >
              {isSpeaking ? <Square className="w-4 h-4 mr-2 fill-current" /> : <Volume2 className="w-4 h-4 mr-2" />}
              {isSpeaking ? 'Stop Reading' : 'Read Aloud'}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={debate.turns.length === 0}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Export MD
          </button>
        </div>
      </div>

      {debate.status === 'error' && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span className="font-semibold">The debate stopped with an error.</span>{' '}
          {debate.error_message}
        </div>
      )}

      <ParticipantsBar participants={participants} />

      {!isActive && debate.turns.length > 0 && <MediaPanel debate={debate} />}

      <div className="space-y-6">
        {debate.turns.length === 0 && !streaming && (
          <div className="p-10 text-center text-gray-400">
            {isActive ? 'Waiting for the first speaker…' : 'No turns were recorded.'}
          </div>
        )}

        {debate.turns.map((turn, index) => {
          const showDivider = index === 0 || debate.turns[index - 1].round_id !== turn.round_id;
          return (
            <div key={turn.seq_index} className="space-y-6">
              {showDivider && <RoundDivider roundId={turn.round_id} />}
              <TurnBubble
                turn={turn}
                participants={participants}
                onPlay={speechSupported ? () => void readTurns(debate.turns, index) : undefined}
              />
            </div>
          );
        })}

        {streaming && (
          <div className="space-y-6">
            {streaming.round_id && streaming.round_id !== lastRound && (
              <RoundDivider roundId={streaming.round_id} />
            )}
            <TurnBubble turn={streaming} participants={participants} streaming />
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default DebateLive;
