import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTHS = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

export const Modal = ({ open, onClose, title, children, footer, width = 'md' }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${WIDTHS[width]} max-h-[92vh] overflow-y-auto rounded-t-panel sm:rounded-panel border border-line-2 bg-surface p-5 md:p-6 shadow-2xl animate-rise`}>
        <div className="flex items-start justify-between gap-4">
          {title && <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>}
          <button type="button" onClick={onClose} className="ml-auto -mr-2 -mt-1 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-text cursor-pointer" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};

interface ConfirmProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog = ({ open, title, body, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onClose }: ConfirmProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    width="sm"
    footer={
      <>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    {body && <div className="text-sm text-text-3 leading-relaxed">{body}</div>}
  </Modal>
);
