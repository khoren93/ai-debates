import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Hint, Input } from '../ui';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
}

interface ShellProps {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}

/** Label + field + hint/error. The label is linked to the input via `htmlFor`. */
const FieldShell = ({ id, label, optional, hint, error, children }: ShellProps) => (
  <div>
    <label htmlFor={id} className="block text-[13px] font-semibold text-text-3">
      {label}
      {optional && <span className="ml-1.5 font-normal text-dim">optional</span>}
    </label>
    <div className="relative mt-1.5">{children}</div>
    {error ? <Hint tone="danger">{error}</Hint> : hint ? <Hint>{hint}</Hint> : null}
  </div>
);

export const FormField = ({ label, optional, hint, error, id, className = '', ...input }: FormFieldProps) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell id={inputId} label={label} optional={optional} hint={hint} error={error}>
      <Input id={inputId} aria-invalid={error ? true : undefined} className={`${error ? 'ring-1 ring-con/50' : ''} ${className}`} {...input} />
    </FieldShell>
  );
};

/** Password input with a show/hide toggle. */
export const PasswordField = ({ label, optional, hint, error, id, className = '', ...input }: Omit<FormFieldProps, 'type'>) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={inputId} label={label} optional={optional} hint={hint} error={error}>
      <Input
        id={inputId}
        type={visible ? 'text' : 'password'}
        aria-invalid={error ? true : undefined}
        className={`pr-11 ${error ? 'ring-1 ring-con/50' : ''} ${className}`}
        {...input}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-muted hover:text-text"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </FieldShell>
  );
};
