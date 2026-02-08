import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Bot, Clock, Download, Volume2, Square, Play, AlertTriangle } from 'lucide-react';
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
  voice_name?: string;
  avatar?: string;
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

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speakingRef = useRef<boolean>(false); // Ref to track status inside loops
  
  // Load voices
  useEffect(() => {
    const loadVoices = () => {
        const vs = window.speechSynthesis.getVoices();
        setVoices(vs);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
    
    // Cleanup on unmount
    return () => {
        window.speechSynthesis.cancel();
    };
  }, []);

  // Fetch initial state
  useEffect(() => {
    const fetchDebate = async () => {
      try {
        const res = await api.get(`/debates/${id}`);
        if (res.data) {
          setDebate(res.data);
          setStatus(res.data.status || 'active');
        } else {
          setStatus('error');
        }
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
    
    // In production, we should use the proxy path /api
    const sseUrl = window.location.hostname === 'localhost' && window.location.port !== '443' && !window.location.protocol.includes('https')
        ? `http://localhost:8000/debates/${id}/stream` 
        : `/api/debates/${id}/stream`;

    const sse = new EventSource(sseUrl);

    // sse.onmessage is not used because we listen to specific events below
    // (turn_delta, turn_completed, debate_completed)
    // Removed unused default handler to fix lint warning.

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
            if (prev.turns?.find(t => t.seq_index === payload.seq_index)) return prev;
            return {
                ...prev,
                turns: [...(prev.turns || []), {
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
    const p = debate.participants?.find(p => p.name === speakerName);
    return p ? p.role === 'moderator' : false;
  };

  const getVoiceForSpeaker = (speakerName: string) => {
      // Deterministic assignment based on name char code sum
      if (voices.length === 0) return null;
      if (!debate) return null;
      
      // Try to find explicit voice choice
      const p = debate.participants?.find(p => p.name === speakerName);
      if (p && p.voice_name) {
          const selected = voices.find(v => v.name === p.voice_name);
          if (selected) return selected;
      }
      
      const isMod = isModerator(speakerName) || speakerName.includes("Verdict");
      if (isMod) {
          // Find a "Google US English" or similar standard voice for moderator
          return voices.find(v => v.name.includes("Google US English")) || voices[0];
      }
      
      // For debaters, pick from available voices excluding the moderator one
      // Simple hash
      const charCodeSum = speakerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const debaterVoices = voices.filter(v => !v.name.includes("Google US English") && v.lang.startsWith("en"));
      if (debaterVoices.length === 0) return voices[0];
      
      return debaterVoices[charCodeSum % debaterVoices.length];
  }

  const handleCreateSpeech = (text: string, speakerName: string) => {
      return new Promise<void>((resolve) => {
          // Remove markdown symbols for cleaner reading
          const cleanText = text.replace(/[*#_`]/g, ''); 
          
          const utter = new SpeechSynthesisUtterance(cleanText);
          const voice = getVoiceForSpeaker(speakerName);
          if (voice) utter.voice = voice;
          
          utter.rate = 1.1; // Slightly faster
          utter.onend = () => resolve();
          utter.onerror = () => resolve(); // Keep going on error
          
          window.speechSynthesis.speak(utter);
      });
  };

  const startPlayback = async (startIndex: number = 0) => {
      if (!debate) return;
      setIsSpeaking(true);
      speakingRef.current = true;
      
      // Cancel any current speech
      window.speechSynthesis.cancel();
      
      // Read turns sequentially from startIndex
      const turnsToRead = debate.turns?.slice(startIndex) || [];

      for (const turn of turnsToRead) {
          if (!speakingRef.current) break;
          // Highlight logic could go here
          await handleCreateSpeech(`${turn.speaker_name} says: ${turn.text}`, turn.speaker_name);
          // Small pause between turns
          await new Promise(r => setTimeout(r, 500));
      }
      
      setIsSpeaking(false);
      speakingRef.current = false;
  };

  const stopPlayback = () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      speakingRef.current = false;
  };

  const handleDownload = () => {
    if (!debate) return;
    
    // Sort turns
    const sortedTurns = [...(debate.turns || [])].sort((a, b) => a.seq_index - b.seq_index);

    let content = `# ${debate.title}\n`;
    content += `Date: ${new Date(debate.created_at).toLocaleString()}\n`;
    content += `Status: ${debate.status}\n\n`;
    content += `## Participants\n`;
    debate.participants?.forEach(p => {
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
        <div className="flex">
            <button 
               onClick={isSpeaking ? stopPlayback : () => startPlayback(0)}
               disabled={!debate || !debate.turns || debate.turns.length === 0}
               className={`flex items-center px-4 py-2 border rounded-lg transition text-sm font-medium shadow-sm mr-2 ${isSpeaking ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-white border-gray-300 hover:bg-gray-50 disabled:opacity-50'}`}
            >
               {isSpeaking ? <Square className="w-4 h-4 mr-2 fill-current" /> : <Volume2 className="w-4 h-4 mr-2" />}
               {isSpeaking ? 'Stop Reading' : 'Read Aloud'}
            </button>
            <button 
               onClick={handleDownload}
               className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium shadow-sm"
            >
               <Download className="w-4 h-4 mr-2" />
               Export MD
            </button>
        </div>
      </div>

      <div className="flex w-full gap-4 mb-8 bg-gray-50 p-4 rounded-lg overflow-x-auto items-center">
         {(debate.participants || []).map((p, idx) => {
             const isDebater = idx > 0;
             // Parse model name: "provider/model-name" -> provider (bold), model-name (small)
             const [provider, ...rest] = (p.model || "").split('/');
             const modelName = rest.length > 0 ? rest.join('/') : null;

             return (
                <div key={idx} className={`flex items-center space-x-2 min-w-fit ${isDebater ? 'flex-row-reverse space-x-reverse' : 'mr-auto pr-8'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!isDebater ? 'bg-blue-600' : 'bg-red-600'} text-white shrink-0 overflow-hidden bg-gray-100`}>
                        {p.avatar ? (
                            <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                            <Bot className="w-6 h-6 text-gray-400" />
                        )}
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
        {(debate.turns || []).map((turn, index) => {
            const isMod = isModerator(turn.speaker_name);
            const speaker = (debate.participants || []).find(p => p.name === turn.speaker_name);
            const avatarUrl = speaker?.avatar;

            // Check for error (starts with [Error...)
            const isError = turn.text.trim().startsWith('[Error');
            
            // Try to extract clean error message
            let displayError = turn.text;
            if (isError) {
                try {
                   // Simple regex to grab the OpenRouter message or just show the start
                   const match = turn.text.match(/OpenRouter Error \d+: (.*)/);
                   if (match) {
                       const jsonPart = match[1].replace(/}\]$/, '}'); // Clean trailing ]
                       const parsed = JSON.parse(jsonPart);
                       if (parsed.error && parsed.error.message) {
                           displayError = `API Error: ${parsed.error.message}`;
                           if (parsed.error.metadata && parsed.error.metadata.provider_name) {
                               displayError += ` (${parsed.error.metadata.provider_name})`;
                           }
                       }
                   } else {
                       // Fallback cleanup
                       displayError = turn.text.replace(/^\[Error generating response: /, '').replace(/\]$/, '');
                   }
                } catch (e) {
                   displayError = "Failed to generate response due to an API error."; 
                }
            }

            return (
            <div key={turn.seq_index} className={`flex flex-col ${isMod ? 'items-start' : 'items-end'}`}>
                <div className="flex items-end gap-2 max-w-[90%] md:max-w-[85%]">
                    {/* Model Avatar (Left) */}
                    {isMod && (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden border border-gray-300">
                             {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : <Bot className="p-1"/>}
                        </div>
                    )}
                    
                    <div className={`flex-1 rounded-2xl p-4 transition-shadow ${
                        isError 
                        ? 'bg-red-50 border border-red-200 text-red-800' 
                        : isMod 
                            ? 'bg-gray-100 border border-gray-200' 
                            : 'bg-blue-50 border border-blue-100 hover:shadow-md'
                    }`}>
                        <div className="flex justify-between items-center mb-1">
                            <p className={`text-xs font-semibold mr-4 ${isError ? 'text-red-600' : 'text-gray-500'}`}>{turn.speaker_name}</p>
                            {!isError && (
                                <button 
                                    onClick={() => startPlayback(index)}
                                    className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-200/50 rounded-full transition-colors"
                                    title="Play from here"
                                >
                                    <Play className="w-3 h-3 fill-current" />
                                </button>
                            )}
                        </div>
                        
                        {isError ? (
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div className="text-sm font-medium whitespace-pre-wrap break-words">
                                    {displayError}
                                </div>
                            </div>
                        ) : (
                            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.text}</ReactMarkdown>
                            </div>
                        )}
                    </div>

                    {/* Debater Avatar (Right) */}
                    {!isMod && (
                        <div className="w-8 h-8 rounded-full bg-red-100 flex-shrink-0 overflow-hidden border border-red-200">
                             {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover"/> : <Bot className="p-1"/>}
                        </div>
                    )}
                </div>
            </div>
            );
        })}

        {streamingTurn && (
             <div className={`flex flex-col animate-pulse ${isModerator(streamingTurn.speaker) ? 'items-start' : 'items-end'}`}>
                 <div className="flex items-end gap-2 max-w-[85%]">
                    {isModerator(streamingTurn.speaker) && <div className="w-8 h-8 rounded-full bg-gray-200" />}
                    
                    <div className={`flex-1 rounded-2xl p-4 border ${isModerator(streamingTurn.speaker) ? 'bg-gray-100 border-gray-200' : 'bg-blue-50 border-blue-100'}`}>
                         <p className="text-xs font-semibold text-gray-500 mb-1">{streamingTurn.speaker || "Thinking..."}</p>
                         <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingTurn.text}</ReactMarkdown>
                            {/* Cursor */}
                            <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse">|</span>
                         </div>
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
