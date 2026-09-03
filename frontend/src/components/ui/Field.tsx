import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const fieldClass =
  'w-full rounded-field border border-line-2 bg-ink px-3.5 py-2.5 text-sm text-text outline-none transition-colors focus:border-accent disabled:opacity-50';

export const Label = ({ children, hint, className = '' }: { children: ReactNode; hint?: ReactNode; className?: string }) => (
  <label className={`block text-[13px] font-semibold text-text-3 ${className}`}>
    {children}
    {hint && <span className="ml-1.5 font-normal text-dim">{hint}</span>}
  </label>
);

export const Hint = ({ children, tone = 'muted', className = '' }: { children: ReactNode; tone?: 'muted' | 'ok' | 'danger' | 'accent'; className?: string }) => {
  const color = { muted: 'text-dim', ok: 'text-ok', danger: 'text-con', accent: 'text-accent' }[tone];
  return <div className={`mt-1.5 text-xs leading-relaxed ${color} ${className}`}>{children}</div>;
};

export const Input = ({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`${fieldClass} ${className}`} {...rest} />
);

export const Textarea = ({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`${fieldClass} leading-relaxed ${className}`} {...rest} />
);

export const Select = ({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`${fieldClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238B90A0%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:12px_12px] bg-[right_12px_center] bg-no-repeat pr-9 ${className}`} {...rest}>
    {children}
  </select>
);
