import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { changePassword } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Button, Card, ErrorBox, SectionLabel, useToast } from '../ui';
import { PasswordField } from './FormField';

const MIN_PASSWORD = 8;

/** "SECURITY" card: collapsible change-password form and sign out. */
export const SecurityCard = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!current) {
      setError('Enter your current password');
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for the new password`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      toast.success('Password changed');
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // The session cookie is gone either way; the context already cleared the user.
    }
    navigate('/');
  };

  return (
    <Card>
      <SectionLabel>Security</SectionLabel>
      <details className="group mt-2.5">
        <summary className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm font-semibold text-text-2 hover:text-text">
          <span className="inline-flex items-center gap-2">
            <KeyRound className="size-4 text-muted" /> Change password
          </span>
          <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <form onSubmit={submit} noValidate className="mt-3 grid gap-3">
          <PasswordField label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            hint={`At least ${MIN_PASSWORD} characters`}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
          <div>
            <Button type="submit" variant="secondary" loading={busy}>
              Update password
            </Button>
          </div>
        </form>
      </details>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <span className="text-xs text-muted">Signing out ends this session on this device.</span>
        <Button variant="secondary" size="sm" onClick={doSignOut} loading={signingOut} icon={<LogOut className="size-4" />}>
          Sign out
        </Button>
      </div>
    </Card>
  );
};
