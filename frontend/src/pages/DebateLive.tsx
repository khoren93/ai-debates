import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, User, Bot, Clock } from 'lucide-react';
// import ReactMarkdown from 'react-markdown'; // Optional for later

interface Turn {
  seq_index: number;
  speaker_name: string;
  text: string;
  created_at?: string;
}

interface Participant {
  name: string;
  role: string;
  model: string;
}

interface Debate {
  id: string;
  title: string;
  status: string;
  created_at: string;
  participants: Participant[];
  turns: Turn[];
}

const DebateLive = () => {
  const { id } = useParams<{ id: string }>();
  const [debate, setDebate] = useState<Debate | null>(null);
  const [streamingTurn, setStreamingTurn] = useState<{ speaker: string, text: string } | null>(null);
  const [status, setStatus] = useState<string>('loading');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial state
  useEffect(() => {
    const fetchDebate = async () => {
      try {
        const res = await api.get(`/debates/${id}`);
        setDebate(res.data);
        setStatus(res.data.status);
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };
    fetchDebate();
  }, [id]);

  // Subscribe to SSE
  useEffect(() => {
    if (!id) return;
    
    // Use relative path or full URL from env
    const sse = new EventSource(`http://localhost:8000/debates/${id}/stream`);

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Based on orchestrator.py events: "turn_delta", "turn_completed", "debate_completed"
      // Note: orchestrator publishes: publish_event(debate_id, "turn_delta", payload)
      // Redis wrapper sends { type, data } ? 
      // Need to verify wrapper logic. Assuming wrapper sends raw JSON payload
      
      // Actually, my redis wrapper in events.py just publishes the payload string?
      // Let's assume standard format: { type: "type", payload: {...} } OR the event names are used as type?
      // SSE usually has event: type.
      
      // If the backend sends `event: turn_delta` then I should use `sse.addEventListener('turn_delta', ...)`
    };

    sse.addEventListener('turn_delta', (e) => {
        const payload = JSON.parse(e.data);
        setStreamingTurn(prev => ({
            speaker: prev?.speaker || "Speaker", // We might not know speaker in delta? 
            // construct streaming state
            text: (prev?.text || "") + payload.delta,
            speaker_name: payload.speaker_name // if available
        } as any));
    });

    sse.addEventListener('turn_completed', (e) => {
        const payload = JSON.parse(e.data);
        // Add to main turns list
        setDebate(prev => {
            if (!prev) return null;
            // Check if turn already exists to avoid dupes
            if (prev.turns.find(t => t.seq_index === payload.seq_index)) return prev;
            return {
                ...prev,
                turns: [...prev.turns, {
                    seq_index: payload.seq_index,
                    speaker_name: payload.speaker_name || "Speaker",
                    text: payload.text
                }]
            };
        });
        setStreamingTurn(null);
    });

    sse.addEventListener('debate_completed', () => {
        setStatus('completed');
        sse.close();
    });

    return () => {
      sse.close();
    };
  }, [id]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [debate?.turns, streamingTurn]);

  if (status === 'loading') return <div className="p-10 text-center">Loading debate...</div>;
  if (!debate) return <div className="p-10 text-center">Debate not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
       <Link to="/" className="flex items-center text-gray-600 mb-6 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </Link>

      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold mb-2">{debate.title}</h1>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
           <span className={`px-2 py-1 rounded capitalize ${debate.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
             {debate.status}
           </span>
           <span className="flex items-center"><Clock className="w-4 h-4 mr-1"/> {new Date(debate.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex justify-between mb-8 bg-gray-50 p-4 rounded-lg">
         {debate.participants.map((p, idx) => (
             <div key={idx} className={`flex items-center space-x-2 ${idx === 1 ? 'flex-row-reverse space-x-reverse' : ''}`}>
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-blue-600' : 'bg-red-600'} text-white`}>
                    <Bot />
                 </div>
                 <div className={idx === 1 ? 'text-right' : ''}>
                     <p className="font-bold">{p.name}</p>
                     <p className="text-xs text-gray-500">{p.model}</p>
                 </div>
             </div>
         ))}
      </div>

      <div className="space-y-6">
        {debate.turns.map((turn) => (
            <div key={turn.seq_index} className={`flex flex-col ${turn.seq_index % 2 === 0 ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 ${turn.seq_index % 2 === 0 ? 'bg-white border hover:shadow-md' : 'bg-blue-50 border border-blue-100 hover:shadow-md'} transition-shadow`}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{turn.speaker_name}</p>
                    <div className="whitespace-pre-wrap">{turn.text}</div>
                </div>
            </div>
        ))}

        {streamingTurn && (
             <div className="flex flex-col items-start animate-pulse">
                <div className="max-w-[80%] rounded-2xl p-4 bg-gray-100 border border-gray-200">
                     <p className="text-xs font-semibold text-gray-500 mb-1">{streamingTurn.speaker || "Thinking..."}</p>
                     <div className="whitespace-pre-wrap">{streamingTurn.text}<span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse">|</span></div>
                </div>
             </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};

export default DebateLive;
