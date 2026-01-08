import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, User, Bot, Clock, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
            speaker: payload.speaker_name || prev?.speaker || "Speaker",
            text: (prev?.text || "") + payload.delta
        }));
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

  if (status === 'loading') return <div className="p-10 text-center">Loading debate...</div>;
  if (!debate) return <div className="p-10 text-center">Debate not found</div>;

  const isModerator = (speakerName: string) => {
    // Attempt to find by matching implicit moderator name "Moderator" or checking role if possible
    // Since turn doesn't have role, we use the known convention
    if (speakerName === "Moderator") return true; 
    if (speakerName.includes("Verdict")) return true; // Catch "⚖️ Moderator (Verdict)"
    
    // Or look up in participants list
    if (!debate) return false;
    const p = debate.participants.find(p => p.name === speakerName);
    return p ? p.role === 'moderator' : false;
  };

  const handleDownload = () => {
    if (!debate) return;
    
    // Sort turns
    const sortedTurns = [...debate.turns].sort((a, b) => a.seq_index - b.seq_index);

    let content = `# ${debate.title}\n`;
    content += `Date: ${new Date(debate.created_at).toLocaleString()}\n`;
    content += `Status: ${debate.status}\n\n`;
    content += `## Participants\n`;
    debate.participants.forEach(p => {
        content += `- ${p.role}: ${p.name} (${p.model})\n`;
    });
    content += `\n---\n\n`;

    sortedTurns.forEach(turn => {
        content += `### ${turn.speaker_name}\n\n`;
        content += `${turn.text}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate-${debate.id}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
       <Link to="/" className="flex items-center text-gray-600 mb-6 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </Link>

      <div className="mb-8 border-b pb-4 flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold mb-2">{debate.title}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
               <span className={`px-2 py-1 rounded capitalize ${debate.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                 {debate.status}
               </span>
               <span className="flex items-center"><Clock className="w-4 h-4 mr-1"/> {new Date(debate.created_at).toLocaleDateString()}</span>
            </div>
        </div>
        <button 
           onClick={handleDownload}
           className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm"
        >
           <Download className="w-4 h-4 mr-2" />
           Export MD
        </button>
      </div>

      <div className="flex w-full gap-4 mb-8 bg-gray-50 p-4 rounded-lg overflow-x-auto items-center">
         {debate.participants.map((p, idx) => {
             const isDebater = idx > 0;
             // Parse model name: "provider/model-name" -> provider (bold), model-name (small)
             const [provider, ...rest] = p.model.split('/');
             const modelName = rest.length > 0 ? rest.join('/') : null;

             return (
                <div key={idx} className={`flex items-center space-x-2 min-w-fit ${isDebater ? 'flex-row-reverse space-x-reverse' : 'mr-auto pr-8'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!isDebater ? 'bg-blue-600' : 'bg-red-600'} text-white shrink-0`}>
                        <Bot />
                    </div>
                    <div className={isDebater ? 'text-right' : ''}>
                        <p className="font-bold whitespace-nowrap">{p.name}</p>
                        {modelName ? (
                            <div className="leading-tight">
                                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{provider}</p>
                                <p className="text-[10px] text-gray-500 font-medium">{modelName}</p>
                            </div>
                        ) : (
                             <p className="text-xs text-gray-500 whitespace-nowrap font-bold">{p.model}</p>
                        )}
                    </div>
                </div>
             );
         })}
      </div>

      <div className="space-y-6">
        {debate.turns.map((turn) => {
            const isMod = isModerator(turn.speaker_name);
            return (
            <div key={turn.seq_index} className={`flex flex-col ${isMod ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 ${isMod ? 'bg-gray-100 border border-gray-200' : 'bg-blue-50 border border-blue-100 hover:shadow-md'} transition-shadow`}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{turn.speaker_name}</p>
                    <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
                    </div>
                </div>
            </div>
            );
        })}

        {streamingTurn && (
             <div className={`flex flex-col animate-pulse ${isModerator(streamingTurn.speaker) ? 'items-start' : 'items-end'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 border ${isModerator(streamingTurn.speaker) ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                     <p className="text-xs font-semibold text-gray-500 mb-1">{streamingTurn.speaker || "Thinking..."}</p>
                     <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingTurn.text}</ReactMarkdown>
                        {/* Cursor */}
                        <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse">|</span>
                     </div>
                </div>
             </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};

export default DebateLive;
