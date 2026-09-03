import { useEffect, useState } from 'react';
import { listModels } from '../api/models';
import type { ModelInfo } from '../api/types';

/** OpenRouter model catalogue, free models first then alphabetical. */
export const useModels = () => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listModels()
      .then((list) => {
        if (cancelled) return;
        const sorted = [...list].sort((a, b) => {
          if (a.is_free !== b.is_free) return a.is_free ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setModels(sorted);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { models, loading, error };
};
