import type { ReactNode } from 'react';

interface ThumbProps {
  gradient: string;
  ratio?: '16/9' | '9/16';
  className?: string;
  children?: ReactNode;
}

/** Gradient thumbnail block with overlay slots (library / gallery cards). */
export const Thumb = ({ gradient, ratio = '16/9', className = '', children }: ThumbProps) => (
  <div className={`relative flex flex-col justify-between p-3.5 ${className}`} style={{ aspectRatio: ratio, background: gradient }}>
    {children}
  </div>
);
