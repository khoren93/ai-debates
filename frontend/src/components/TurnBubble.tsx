import { Bot, Play, Scale, TriangleAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Participant, Turn, TurnUsage } from '../api/types';
import { formatCost, formatTokens, isErrorTurn, turnErrorMessage } from '../lib/format';

interface Props {
  turn: Pick<Turn, 'speaker_name' | 'speaker_role' | 'turn_type' | 'text'> &
    Partial<Pick<Turn, 'error' | 'usage' | 'model_used'>>;
  participants: Participant[];
  streaming?: boolean;
  onPlay?: () => void;
}

const UsageFooter = ({ usage, model }: { usage?: TurnUsage; model?: string }) => {
  const hasUsage = usage && usage.total_tokens > 0;
  if (!hasUsage && !model) return null;
  return (
    <div className="mt-2 pt-2 border-t border-black/5 flex flex-wrap gap-x-3 text-[10px] text-gray-400">
      {model && <span className="truncate max-w-[220px]" title={model}>{model}</span>}
      {hasUsage && (
        <span>
          {formatTokens(usage.prompt_tokens)} in / {formatTokens(usage.completion_tokens)} out
          {usage.cost > 0 && ` · ${formatCost(usage.cost)}`}
        </span>
      )}
    </div>
  );
};

const TurnBubble = ({ turn, participants, streaming = false, onPlay }: Props) => {
  const isVerdict = turn.turn_type === 'verdict';
  const isModerator = turn.speaker_role === 'moderator';
  const isError = !streaming && isErrorTurn({ error: turn.error ?? null, text: turn.text });
  const avatarUrl = participants.find((p) => p.name === turn.speaker_name)?.avatar ?? null;

  const avatar = (
    <div
      className={`w-8 h-8 rounded-full shrink-0 overflow-hidden border flex items-center justify-center ${
        isModerator ? 'bg-gray-200 border-gray-300' : 'bg-red-100 border-red-200'
      }`}
    >
      {isVerdict ? (
        <Scale className="w-4 h-4 text-amber-700" />
      ) : avatarUrl ? (
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <Bot className="w-5 h-5 text-gray-500" />
      )}
    </div>
  );

  const bubbleStyle = isError
    ? 'bg-red-50 border-red-200 text-red-800'
    : isVerdict
      ? 'bg-amber-50 border-amber-200'
      : isModerator
        ? 'bg-gray-100 border-gray-200'
        : 'bg-blue-50 border-blue-100 hover:shadow-md';

  return (
    <div
      className={`flex flex-col ${isVerdict ? 'items-stretch' : isModerator ? 'items-start' : 'items-end'} ${
        streaming ? 'animate-pulse' : ''
      }`}
    >
      <div className={`flex items-end gap-2 ${isVerdict ? 'w-full' : 'max-w-[90%] md:max-w-[85%]'}`}>
        {(isModerator || isVerdict) && avatar}

        <div className={`flex-1 rounded-2xl p-4 border transition-shadow ${bubbleStyle}`}>
          <div className="flex justify-between items-center mb-1">
            <p className={`text-xs font-semibold mr-4 ${isError ? 'text-red-600' : 'text-gray-500'}`}>
              {turn.speaker_name}
            </p>
            {!isError && !streaming && onPlay && turn.text.trim() && (
              <button
                type="button"
                onClick={onPlay}
                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-200/50 rounded-full transition-colors"
                title="Play from here"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            )}
          </div>

          {isError ? (
            <div className="space-y-2">
              {turn.text.trim() && turn.error && (
                <div className="prose prose-sm max-w-none prose-p:my-1 text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
                </div>
              )}
              <div className="flex items-start gap-2">
                <TriangleAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm font-medium whitespace-pre-wrap break-words">
                  {turnErrorMessage({ error: turn.error ?? null, text: turn.text })}
                </div>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
              {turn.text ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
              ) : (
                streaming && <span className="text-gray-400 italic">Thinking…</span>
              )}
              {streaming && turn.text && (
                <span className="inline-block w-2 h-4 ml-1 bg-gray-400 align-middle animate-pulse" />
              )}
            </div>
          )}

          {!streaming && <UsageFooter usage={turn.usage} model={turn.model_used} />}
        </div>

        {!isModerator && !isVerdict && avatar}
      </div>
    </div>
  );
};

export default TurnBubble;
