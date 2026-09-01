import { statusStyle } from '../lib/format';

const StatusBadge = ({ status, className = '' }: { status: string; className?: string }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusStyle(status)} ${className}`}
  >
    {status === 'running' && (
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
    )}
    {status}
  </span>
);

export default StatusBadge;
