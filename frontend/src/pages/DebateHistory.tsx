import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Plus, MessageSquare, Trash2 } from 'lucide-react';

interface DebateSummary {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const DebateHistory = () => {
  const [debates, setDebates] = useState<DebateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebates = async () => {
      try {
        const res = await api.get('/debates/');
        setDebates(res.data);
      } catch (err) {
        console.error("Failed to fetch debates", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDebates();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to delete this debate?")) return;

    try {
      await api.delete(`/debates/${id}`);
      setDebates(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error("Failed to delete debate", err);
      alert("Failed to delete debate");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
           <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
              AI Debates
           </h1>
           <p className="mt-2 text-lg text-gray-500">
             Watch AI models debate any topic in real-time.
           </p>
        </div>
        <Link 
          to="/create" 
          className="bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition shadow-lg flex items-center"
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
             <div className="p-10 text-center text-gray-500">Loading...</div>
        ) : debates.length === 0 ? (
             <div className="p-10 text-center text-gray-500">
                No debates yet. Create one to get started!
             </div>
        ) : (
             <div className="divide-y divide-gray-100">
               {debates.map((debate) => (
                 <Link 
                   key={debate.id} 
                   to={`/debate/${debate.id}`}
                   className="block p-6 hover:bg-gray-50 transition duration-150 ease-in-out group"
                 >
                   <div className="flex items-center justify-between">
                      <div className="flex items-center">
                          <div className="p-3 rounded-lg bg-blue-100 text-blue-600 mr-4 group-hover:bg-blue-200 transition">
                              <MessageSquare className="w-6 h-6" />
                          </div>
                          <div>
                              <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition">{debate.title}</h3>
                              <p className="text-sm text-gray-500">{new Date(debate.created_at).toLocaleDateString()} • {debate.status}</p>
                          </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={(e) => handleDelete(e, debate.id)}
                          className="text-gray-400 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50"
                          title="Delete Debate"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <div className="text-gray-400 group-hover:text-gray-600">
                            →
                        </div>
                      </div>
                   </div>
                 </Link>
               ))}
             </div>
        )}
      </div>
    </div>
  );
};

export default DebateHistory;
