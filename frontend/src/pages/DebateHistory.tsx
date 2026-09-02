import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { deleteDebate, listDebates } from '../api/debates';
import { getErrorMessage } from '../api/client';
import type { DebateSummary } from '../api/types';
import StatusBadge from '../components/StatusBadge';
import { formatCost } from '../lib/format';

const DebateHistory = () => {
  const [debates, setDebates] = useState<DebateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bumped by "Retry" to re-run the fetch effect.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listDebates()
      .then((data) => {
        if (cancelled) return;
        setDebates(data);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this debate?')) return;
    try {
      await deleteDebate(id);
      setDebates((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(`Failed to delete debate: ${getErrorMessage(err)}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            AI Debates
          </h1>
          <p className="mt-2 text-lg text-gray-500">Watch AI models debate any topic in real-time.</p>
        </div>
        <Link
          to="/create"
          className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition shadow-lg inline-flex items-center self-start sm:self-auto"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Debate
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-700">Recent Debates</h2>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading…</div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-red-600 mb-3">{error}</p>
            <button onClick={retry} className="text-blue-600 hover:underline">Retry</button>
          </div>
        ) : debates.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No debates yet. Create one to get started!</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {debates.map((debate) => (
              <li key={debate.id} className="flex items-center hover:bg-gray-50 transition group">
                <Link to={`/debate/${debate.id}`} className="flex-1 min-w-0 flex items-center p-6">
                  <div className="p-3 rounded-lg bg-blue-100 text-blue-600 mr-4 group-hover:bg-blue-200 transition shrink-0">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition truncate">
                      {debate.title ?? 'Untitled debate'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
                      <span>{new Date(debate.created_at).toLocaleString()}</span>
                      <StatusBadge status={debate.status} />
                      {debate.media_status === 'ready' && (
                        <span className="inline-flex items-center text-blue-600" title="Audio and video available">
                          <Headphones className="w-3.5 h-3.5 mr-1" /> audio
                        </span>
                      )}
                      {debate.totals.cost > 0 && <span>{formatCost(debate.totals.cost)}</span>}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-2 pr-6">
                  <button
                    type="button"
                    onClick={() => void handleDelete(debate.id)}
                    className="text-gray-400 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50"
                    title="Delete debate"
                    aria-label="Delete debate"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <Link to={`/debate/${debate.id}`} className="text-gray-400 group-hover:text-gray-600" aria-label="Open debate">
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DebateHistory;
