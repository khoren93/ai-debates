import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Plus } from 'lucide-react';

interface Model {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string; image: string; request: string };
  context_length: number;
}

const CreateDebate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  
  const [formData, setFormData] = useState({
    topic: '',
    description: '',
    num_rounds: 3,
    participant1_name: 'Debater 1',
    participant1_model: '',
    participant1_prompt: 'You are a skilled debater. Argue in favor of the topic.',
    participant2_name: 'Debater 2',
    participant2_model: '',
    participant2_prompt: 'You are a skilled debater. Argue against the topic.',
  });

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await api.get('/models/');
        setModels(res.data);
        if (res.data.length > 0) {
          setFormData(prev => ({
            ...prev,
            participant1_model: res.data[0].id,
            participant2_model: res.data[0].id
          }));
        }
      } catch (err) {
        console.error("Failed to fetch models", err);
      }
    };
    fetchModels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Construct payload matching backend schema
      const payload = {
        topic: formData.topic,
        description: formData.description,
        num_rounds: formData.num_rounds,
        participants: [
          {
            name: formData.participant1_name,
            model_id: formData.participant1_model,
            prompt: formData.participant1_prompt,
            position: 1
          },
          {
            name: formData.participant2_name,
            model_id: formData.participant2_model,
            prompt: formData.participant2_prompt,
            position: 2
          }
        ]
      };

      const res = await api.post('/debates/', payload);
      navigate(`/debate/${res.data.id}`);
    } catch (err) {
      console.error("Failed to create debate", err);
      alert("Error creating debate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={() => navigate('/')} className="flex items-center text-gray-600 mb-6 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </button>

      <h1 className="text-3xl font-bold mb-8">Create New Debate</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">Topic & Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Debate Topic</label>
              <input
                type="text"
                required
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.topic}
                onChange={e => setFormData({...formData, topic: e.target.value})}
                placeholder="e.g. Is AI dangerous?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Rounds</label>
              <input
                type="number"
                min={1}
                max={10}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                value={formData.num_rounds}
                onChange={e => setFormData({...formData, num_rounds: parseInt(e.target.value)})}
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Participant 1 */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">Participant 1 (Pro)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                  value={formData.participant1_name}
                  onChange={e => setFormData({...formData, participant1_name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={formData.participant1_model}
                  onChange={e => setFormData({...formData, participant1_model: e.target.value})}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">System Prompt</label>
                <textarea
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={formData.participant1_prompt}
                  onChange={e => setFormData({...formData, participant1_prompt: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* Participant 2 */}
          <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Participant 2 (Con)</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  className="w-full p-2 border border-gray-300 rounded"
                  value={formData.participant2_name}
                  onChange={e => setFormData({...formData, participant2_name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Model</label>
                <select
                  className="w-full p-2 border border-gray-300 rounded"
                  value={formData.participant2_model}
                  onChange={e => setFormData({...formData, participant2_model: e.target.value})}
                >
                  {models.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">System Prompt</label>
                <textarea
                  rows={4}
                  className="w-full p-2 border border-gray-300 rounded text-sm"
                  value={formData.participant2_prompt}
                  onChange={e => setFormData({...formData, participant2_prompt: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-bold text-lg"
        >
          {loading ? 'Starting Debate...' : <><Plus className="w-5 h-5 mr-2"/> Start Debate</>}
        </button>
      </form>
    </div>
  );
};

export default CreateDebate;
