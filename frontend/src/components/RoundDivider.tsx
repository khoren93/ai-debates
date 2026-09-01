import { roundLabel } from '../lib/format';

const RoundDivider = ({ roundId }: { roundId: string }) => (
  <div className="flex items-center gap-3 my-2">
    <div className="flex-1 h-px bg-gray-200" />
    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
      {roundLabel(roundId)}
    </span>
    <div className="flex-1 h-px bg-gray-200" />
  </div>
);

export default RoundDivider;
