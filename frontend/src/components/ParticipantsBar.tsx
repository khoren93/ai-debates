import { Bot } from 'lucide-react';
import type { Participant } from '../api/types';

const Avatar = ({ participant, isModerator }: { participant: Participant; isModerator: boolean }) => (
  <div
    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border ${
      isModerator ? 'bg-gray-200 border-gray-300' : 'bg-red-100 border-red-200'
    }`}
  >
    {participant.avatar ? (
      <img src={participant.avatar} alt={participant.name ?? ''} className="w-full h-full object-cover" />
    ) : (
      <Bot className="w-6 h-6 text-gray-500" />
    )}
  </div>
);

const ModelLabel = ({ model }: { model: string }) => {
  const [provider, ...rest] = (model || '').split('/');
  const modelName = rest.length > 0 ? rest.join('/') : null;
  if (!modelName) return <p className="text-xs text-gray-500 font-bold whitespace-nowrap">{model}</p>;
  return (
    <div className="leading-tight">
      <p className="text-[10px] font-bold text-gray-700 uppercase tracking-wide">{provider}</p>
      <p className="text-[10px] text-gray-500 font-medium">{modelName}</p>
    </div>
  );
};

const ParticipantsBar = ({ participants }: { participants: Participant[] }) => {
  const moderators = participants.filter((p) => p.role === 'moderator');
  const debaters = participants.filter((p) => p.role !== 'moderator');

  return (
    <div className="flex w-full gap-6 mb-8 bg-white border border-gray-200 p-4 rounded-lg overflow-x-auto items-center">
      {moderators.map((p, idx) => (
        <div key={`m-${idx}`} className="flex items-center gap-2 min-w-fit mr-auto pr-4">
          <Avatar participant={p} isModerator />
          <div>
            <p className="font-bold whitespace-nowrap">{p.name}</p>
            <ModelLabel model={p.model} />
          </div>
        </div>
      ))}
      {debaters.map((p, idx) => (
        <div key={`d-${idx}`} className="flex flex-row-reverse items-center gap-2 min-w-fit">
          <Avatar participant={p} isModerator={false} />
          <div className="text-right">
            <p className="font-bold whitespace-nowrap">{p.name}</p>
            <ModelLabel model={p.model} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ParticipantsBar;
