import type { ReactNode } from 'react';

interface EmptyProps {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({ icon, title, text, action, className = '' }: EmptyProps) => (
  <div className={`flex flex-col items-center justify-center rounded-panel border border-dashed border-line-2 px-6 py-16 text-center ${className}`}>
    {icon && <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-surface-2 text-muted">{icon}</div>}
    <div className="font-display text-lg font-bold tracking-tight">{title}</div>
    {text && <div className="mt-1.5 max-w-sm text-sm text-muted leading-relaxed">{text}</div>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorBox = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-field border border-con/30 bg-con/10 px-4 py-3 text-sm text-[#ffb3a7] leading-relaxed ${className}`}>{children}</div>
);
