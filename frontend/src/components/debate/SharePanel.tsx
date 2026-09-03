import { Check, Copy, Globe, Link2Off } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../../api/client';
import { publishDebate, unpublishDebate } from '../../api/debates';
import { GALLERY_CATEGORIES, type DebateDetail } from '../../api/types';
import { Button, Chip, useToast } from '../ui';

interface Props {
  debate: DebateDetail;
  onChange: (patch: Partial<DebateDetail>) => void;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Share strip under the header: publish to the gallery, copy the link, unpublish. */
export const SharePanel = ({ debate, onChange }: Props) => {
  const toast = useToast();
  const [category, setCategory] = useState<string | null>(debate.category);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const publish = async () => {
    setBusy(true);
    try {
      const res = await publishDebate(debate.id, category);
      onChange({ is_public: res.is_public, slug: res.slug, share_url: res.share_url, category });
      toast.success('Published to the gallery');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    setBusy(true);
    try {
      const res = await unpublishDebate(debate.id);
      onChange({ is_public: res.is_public, share_url: null });
      toast.info('The debate is private again');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!debate.share_url) return;
    try {
      await navigator.clipboard.writeText(debate.share_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  if (debate.is_public && debate.share_url) {
    return (
      <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-field border border-accent/40 bg-surface py-2.5 pl-4 pr-2.5 font-mono text-[13px] animate-rise">
        <Globe className="size-4 text-accent" />
        <span className="min-w-[200px] flex-1 truncate text-text-3">{debate.share_url.replace(/^https?:\/\//, '')}</span>
        <Button size="sm" onClick={copy} icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="secondary" onClick={unpublish} loading={busy} icon={<Link2Off className="size-3.5" />}>
          Unpublish
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-field border border-line-2 bg-surface p-2.5 pl-4 animate-rise">
      <span className="text-[13px] text-text-3">Category</span>
      <div className="flex flex-wrap gap-1.5">
        {GALLERY_CATEGORIES.map((c) => (
          <Chip key={c} size="sm" active={category === c} onClick={() => setCategory(category === c ? null : c)}>
            {capitalise(c)}
          </Chip>
        ))}
      </div>
      <Button size="sm" className="ml-auto" onClick={publish} loading={busy} disabled={debate.status !== 'completed'} icon={<Globe className="size-3.5" />}>
        Publish to gallery
      </Button>
    </div>
  );
};
