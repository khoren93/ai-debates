import { useState, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { removeOpenRouterKey, setOpenRouterKey } from '../../api/auth';
import { getErrorMessage } from '../../api/client';
import type { User } from '../../api/types';
import { Button, Card, ConfirmDialog, Hint, Input, SectionLabel, useToast } from '../ui';

const HINT = 'Your key runs paid models without touching credits.';

/** "OPENROUTER KEY" card: masked key + Replace / Remove, or an input to save one. */
export const KeyCard = ({ user, onUser }: { user: User; onUser: (user: User) => void }) => {
  const toast = useToast();
  const [replacing, setReplacing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const masked = user.openrouter_key_masked;
  const editing = !masked || replacing;

  const cancelEdit = () => {
    setReplacing(false);
    setDraft('');
    setError(null);
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const key = draft.trim();
    if (!key) {
      setError('Paste your OpenRouter key first');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onUser(await setOpenRouterKey(key));
      toast.success('OpenRouter key saved');
      setDraft('');
      setReplacing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    try {
      onUser(await removeOpenRouterKey());
      toast.success('OpenRouter key removed');
      setConfirmRemove(false);
      cancelEdit();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Card>
      <SectionLabel>OpenRouter key</SectionLabel>
      {editing ? (
        <form onSubmit={save} className="mt-2.5 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-or-…"
            autoComplete="off"
            spellCheck={false}
            autoFocus={replacing}
            aria-label="OpenRouter API key"
            className="min-w-0 flex-1 font-mono text-xs!"
          />
          <Button type="submit" variant="secondary" loading={saving}>
            Save key
          </Button>
          {masked && (
            <Button variant="ghost" onClick={cancelEdit} disabled={saving} aria-label="Cancel" icon={<X className="size-4" />} className="px-3" />
          )}
        </form>
      ) : (
        <div className="mt-2.5 flex gap-2">
          <Input value={masked} readOnly aria-label="Saved OpenRouter key" className="min-w-0 flex-1 font-mono text-xs! text-text-3" />
          <Button variant="secondary" onClick={() => setReplacing(true)}>
            Replace
          </Button>
          <Button variant="danger" onClick={() => setConfirmRemove(true)} aria-label="Remove key" icon={<Trash2 className="size-4" />} className="px-3" />
        </div>
      )}
      {error ? <Hint tone="danger">{error}</Hint> : <Hint>{HINT}</Hint>}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove OpenRouter key?"
        body="Paid models will be charged to your credits again. You can add a key back at any time."
        confirmLabel="Remove key"
        danger
        busy={removing}
        onConfirm={remove}
        onClose={() => setConfirmRemove(false)}
      />
    </Card>
  );
};
