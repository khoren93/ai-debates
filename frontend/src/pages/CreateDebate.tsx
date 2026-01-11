import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Plus, ChevronDown, Volume2, PlayCircle } from 'lucide-react';
import { TOPIC_TEMPLATES } from '../data/topics';
import { STYLE_PRESETS } from '../data/styles';

interface Model {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string; image: string; request: string };
  context_length: number;
  is_free: boolean;
}

interface Voice {
    name: string;
    lang: string;
}

const getLangCode = (langName: string) => {
    switch (langName) {
        case 'Russian': return 'ru';
        case 'Spanish': return 'es';
        case 'French': return 'fr';
        case 'German': return 'de';
        case 'Chinese': return 'zh';
        default: return 'en';
    }
};

const getAvatarUrl = (seed: string) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}`;

const formatPrice = (pricing: { prompt: string; completion: string }) => {
    const c = parseFloat(pricing.completion) * 1000000;
    return `$${c.toFixed(2)}`;
};

const formatContext = (length: number) => {
    if (!length) return '?';
    if (length >= 1000000) {
        return `${Math.round(length / 1000000)}M`;
    }
    if (length >= 1000) {
        return `${Math.round(length / 1000)}k`;
    }
    return `${length}`;
};

const CreateDebate = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);
  
  // Track open style dropdowns by participant index
  const [openStyleIdx, setOpenStyleIdx] = useState<number | null>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  const [models, setModels] = useState<Model[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const [customKeyCredits, setCustomKeyCredits] = useState<number | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Check custom key credits
  useEffect(() => {
    const checkKey = async () => {
        if (!customApiKey || customApiKey.length < 10) {
            setCustomKeyCredits(null);
            return;
        }
        setCheckingKey(true);
        try {
            const res = await api.get(`/models/credits?api_key=${customApiKey}`);
            setCustomKeyCredits(res.data.credits);
        } catch (e) {
            console.error("Failed to check custom key credits", e);
            setCustomKeyCredits(0);
        } finally {
            setCheckingKey(false);
        }
    };

    const timer = setTimeout(checkKey, 800);
    return () => clearTimeout(timer);
  }, [customApiKey]);

  const isPaidLocked = customApiKey 
      ? (customKeyCredits !== null && customKeyCredits <= 0) 
      : (credits !== null && credits <= 0);

  useEffect(() => {
    const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        // Sort by name or lang
        available.sort((a, b) => a.name.localeCompare(b.name));
        setVoices(available);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const [settings, setSettings] = useState({
    topic: '',
    description: '',
    language: 'English',
    num_rounds: 2, 
    length_preset: 'very_short', // short, medium, long
    moderator_model: '',
    moderator_voice: '', // Added voice
    moderator_avatar: Math.random().toString(36).substring(7),
    num_participants: 2, // 2-5
  });

  const [participants, setParticipants] = useState([
      { name: 'Debater 1', model: '', voice: '', avatar: Math.random().toString(36).substring(7), prompt: 'You are a skilled debater. Argue in favor of the topic.\n\nStyle: Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts.', position: 1 },
      { name: 'Debater 2', model: '', voice: '', avatar: Math.random().toString(36).substring(7), prompt: 'You are a skilled debater. Argue against the topic.\n\nStyle: Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts.', position: 2 }
  ]);


  // Click outside to close templates and style dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
      if (styleRef.current && !styleRef.current.contains(event.target as Node)) {
          setOpenStyleIdx(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const [resModels, resCredits] = await Promise.all([
            api.get('/models/'),
            api.get('/models/credits')
        ]);

        const currentCredits = resCredits.data?.credits || 0;
        setCredits(currentCredits);

        // Backend returns { data: [...], timestamp: ... }
        let modelsList: Model[] = resModels.data.data || [];
        
        // Sort: Free models first, then by name
        modelsList.sort((a, b) => {
            if (a.is_free && !b.is_free) return -1;
            if (!a.is_free && b.is_free) return 1;
            return a.name.localeCompare(b.name);
        });

        setModels(modelsList);
        
        if (modelsList.length > 0) {
            // Pick the first free model as default, or just the first available
            const defaultModel = modelsList.find(m => m.is_free) || modelsList[0];
            
            setSettings(prev => ({ ...prev, moderator_model: defaultModel.id }));
            
            setParticipants(prev => prev.map(p => ({
                ...p,
                model: defaultModel.id
            })));
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
    };
    fetchModels();
  }, []);

  // Set default voices when they load or when language changes
  useEffect(() => {
      if (voices.length > 0) {
          const langCode = getLangCode(settings.language);
          const langVoices = voices.filter(v => v.lang.startsWith(langCode));
          const fallbackVoices = langVoices.length > 0 ? langVoices : voices;

          setSettings(prev => {
             // If current voice matches language, keep it. Otherwise switch.
             if (prev.moderator_voice === "") return prev;
             const currentVoice = voices.find(v => v.name === prev.moderator_voice);
             if (currentVoice && currentVoice.lang.startsWith(langCode)) return prev;

             // Don't force a specific voice, let it stay default (empty string)
             return { ...prev, moderator_voice: "" };
          });

          setParticipants(prev => prev.map((p, idx) => {
              const currentVoice = voices.find(v => v.name === p.voice);
              if (currentVoice && currentVoice.lang.startsWith(langCode)) return p;
              
              // Prefer Samantha if available for English/default
              const samantha = fallbackVoices.find(v => v.name === 'Samantha');
              if (samantha) return { ...p, voice: samantha.name };

              const choice = fallbackVoices.length > 0 ? fallbackVoices[(idx + 1) % fallbackVoices.length] : voices[0];
              return { ...p, voice: choice.name };
          }));
      }
  }, [voices, settings.language]);


  // Update participant count
  useEffect(() => {
     setParticipants(prev => {
         const newCount = settings.num_participants;
         if (newCount === prev.length) return prev;
         
         if (newCount > prev.length) {
             // Add participants
             const added = [];
             const defaultModelId = models.length > 0 ? (models.find(m => m.name.toLowerCase().includes('(free)')) || models[0]).id : '';
             
             const langCode = getLangCode(settings.language);
             const langVoices = voices.filter(v => v.lang.startsWith(langCode));
             const fallbackVoices = langVoices.length > 0 ? langVoices : voices;

             for (let i = prev.length + 1; i <= newCount; i++) {
                 // Try to assign a voice
                 let voiceName = '';
                 if (voices.length > 0) {
                     const samantha = fallbackVoices.find(v => v.name === 'Samantha');
                     if (samantha) {
                        voiceName = samantha.name;
                     } else {
                        const choice = fallbackVoices.length > 0 ? fallbackVoices[i % fallbackVoices.length] : voices[0];
                        voiceName = choice.name;
                     }
                 }

                 added.push({
                     name: `Debater ${i}`,
                     model: defaultModelId,
                     voice: voiceName,
                     avatar: `Debater${i}-${Math.random().toString(36).substring(7)}`,
                     prompt: `You are a skilled debater. Provide a unique perspective on the topic (Position ${i}).\n\nStyle: Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts.`,
                     position: i
                 });
             }
             return [...prev, ...added];
         } else {
             // Remove participants
             return prev.slice(0, newCount);
         }
     });
  }, [settings.num_participants, models, voices, settings.language]);

  const updateParticipant = (index: number, field: string, value: string) => {
      const newP = [...participants];
      newP[index] = { ...newP[index], [field]: value };
      setParticipants(newP);
  };

  const applyStyle = (index: number, styleDesc: string) => {
      const p = participants[index];
      // Regex to find existing "Style: ..." block
      // We look for "Style: " followed by anything until end of string or double newline
      // But simplifying: Just append if not found, or replace if specific pattern exists
      
      let newPrompt = p.prompt;
      if (newPrompt.includes('Style:')) {
          // Replace existing Style section
          // The regex looks for Style: ... until end of string, assuming style is at the end
          newPrompt = newPrompt.replace(/Style:[\s\S]*$/, `Style: ${styleDesc}`);
      } else {
          newPrompt = `${newPrompt}\n\nStyle: ${styleDesc}`;
      }
      
      updateParticipant(index, 'prompt', newPrompt);
      setOpenStyleIdx(null);
  }

  const previewVoice = (voiceName: string, text: string) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = voices.find(v => v.name === voiceName);
      if (voice) utter.voice = voice;
      window.speechSynthesis.speak(utter);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidating(true);

    // Determine if paid models are allowed
    const isPaidLocked = customApiKey 
        ? (customKeyCredits !== null && customKeyCredits <= 0) 
        : (credits !== null && credits <= 0);

    try {
      // Determine effective models
      const defaultModModel = settings.moderator_model || (models.length > 0 ? models[0].id : '');
      const modelIdsToValidate = [
          defaultModModel,
          ...participants.map(p => p.model)
      ].filter((v, i, a) => v && a.indexOf(v) === i); // Unique non-empty values

      // Check if we are using paid models while locked
      const usedPaidModels = modelIdsToValidate.some(mid => {
          const m = models.find(mod => mod.id === mid);
          return m && !m.is_free;
      });

      if (usedPaidModels && isPaidLocked) {
          alert("You have selected paid models but have insufficient credits (System or Custom Key). Please switch to free models or add a valid key.");
          setValidating(false);
          return;
      }

      // Validate Models
      if (modelIdsToValidate.length > 0) {
          const valRes = await api.post('/models/validate', { 
            model_ids: modelIdsToValidate,
            api_key: customApiKey || undefined
          });
          const failures = valRes.data.results.filter((r: any) => r.status !== 'ok');
          
          if (failures.length > 0) {
              let msg = "The following models are unresponsive:\n\n";
              
              failures.forEach((f: any) => {
                  const m = models.find(md => md.id === f.model_id);
                  const name = m ? m.name : f.model_id;
                  const errorDetail = f.error || "Unknown connection error";
                  msg += `${name}\n${errorDetail}\n\n`;
              });
              
              msg += "Please select different models.";
              
              alert(msg);
              setValidating(false);
              return;
          }
      }
    } catch (valErr) {
        console.error("Validation check failed", valErr);
        alert("Failed to validate models connectivity. Please try again.");
        setValidating(false);
        return;
    }

    setValidating(false);
    setLoading(true);
    try {
      const defaultModModel = settings.moderator_model || (models.length > 0 ? models[0].id : '');

      // Construct payload
      const payload = {
        topic: settings.topic,
        description: settings.description,
        language: settings.language,
        num_rounds: settings.num_rounds,
        length_preset: settings.length_preset,
        debate_preset_id: "custom",
        user_provider_key: customApiKey || undefined,
        participants: [
            // Moderator
            {
                role: "moderator",
                model_id: defaultModModel,
                display_name: "Moderator",
                persona_custom: "You are an impartial debate moderator. Briefly introduce the next speaker and summarize the current state of the debate.",
                voice_name: settings.moderator_voice,
                avatar_url: getAvatarUrl(settings.moderator_avatar)
            },
            // Dynamic Debaters
            ...participants.map(p => ({
                role: "debater",
                model_id: p.model,
                display_name: p.name,
                persona_custom: p.prompt,
                voice_name: p.voice,
                avatar_url: getAvatarUrl(p.avatar)
            }))
        ]
      };

      const res = await api.post('/debates/', payload);
      navigate(`/debate/${res.data.debate_id}`);
    } catch (err) {
      console.error("Failed to create debate", err);
      alert("Error creating debate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
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
              <div className="relative" ref={templatesRef}>
                  <div className="flex">
                    <input
                        type="text"
                        required
                        className="w-full h-10 p-2 border border-gray-300 rounded-l focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10"
                        value={settings.topic}
                        onChange={e => setSettings({...settings, topic: e.target.value})}
                        placeholder="e.g. Is AI dangerous?"
                    />
                    <button
                        type="button"
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="h-10 px-3 border border-l-0 border-gray-300 bg-gray-50 rounded-r hover:bg-gray-100 flex items-center transition-colors"
                        title="Choose from templates"
                    >
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                  
                  {showTemplates && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Example Topics</div>
                        {TOPIC_TEMPLATES.map((t, i) => (
                            <button
                                key={i}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b last:border-0 border-gray-100 group"
                                onClick={() => {
                                    setSettings(prev => ({ 
                                        ...prev, 
                                        topic: t.topic, 
                                        description: t.desc 
                                    }));
                                    setShowTemplates(false);
                                }}
                            >
                                <div className="font-semibold text-gray-800 group-hover:text-blue-700">{t.label}</div>
                                <div className="text-xs text-gray-500 whitespace-normal">{t.topic}</div>
                            </button>
                        ))}
                    </div>
                  )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                value={settings.description}
                onChange={e => setSettings({...settings, description: e.target.value})}
                placeholder="e.g. Provide context about the setting, specific rules, or the tone of the debate..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                className="w-full h-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                value={settings.language}
                onChange={e => setSettings({...settings, language: e.target.value})}
              >
                <option value="English">English</option>
                <option value="Russian">Russian</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Chinese">Chinese</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Rounds</label>
                  <select
                    className="w-full h-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    value={settings.num_rounds}
                    onChange={e => setSettings({...settings, num_rounds: parseInt(e.target.value)})}
                  >
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
                  <select
                    className="w-full h-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    value={settings.num_participants}
                    onChange={e => setSettings({...settings, num_participants: parseInt(e.target.value)})}
                  >
                    {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
            </div>
            
             <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Response Length</label>
              <select
                className="w-full h-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                value={settings.length_preset}
                onChange={e => setSettings({...settings, length_preset: e.target.value})}
              >
                <option value="very_short">Very Short (~50 words)</option>
                <option value="short">Short (~100 words)</option>
                <option value="medium">Medium (~250 words)</option>
                <option value="long">Long (~500 words)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-gray-100 mt-2 flex gap-4">
                {/* Avatar Column */}
                <div className="flex-shrink-0 flex flex-col items-center space-y-2 pt-6">
                    <img 
                        src={getAvatarUrl(settings.moderator_avatar)} 
                        alt="Moderator Avatar" 
                        className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200"
                    />
                    <button
                        type="button"
                        onClick={() => setSettings({...settings, moderator_avatar: Math.random().toString(36).substring(7)})}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                        Randomize
                    </button>
                </div>

                {/* Controls */}
                <div className="flex-grow grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Moderator Model</label>
                        <div className="relative">
                            <select
                            className="w-full h-10 p-2 border border-gray-300 rounded"
                            value={settings.moderator_model}
                            onChange={e => setSettings({...settings, moderator_model: e.target.value})}
                            >
                            <optgroup label="Free Models">
                                {models.filter(m => m.is_free).map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({formatContext(m.context_length)})</option>
                                ))}
                            </optgroup>
                            <optgroup label={`Paid Models ${isPaidLocked ? '(Disabled due to low credits)' : '($ per 1M tokens)'}`}>
                                {models.filter(m => !m.is_free).map(m => (
                                    <option key={m.id} value={m.id} disabled={isPaidLocked}>
                                        {m.name} ({formatContext(m.context_length)} | {formatPrice(m.pricing)})
                                    </option>
                                ))}
                            </optgroup>
                            </select>
                            {/* Legend/Helper text */}
                            {credits !== null && credits <= 0 && !customApiKey && (
                                <div className="text-[10px] text-gray-500 mt-1">Paid models are disabled because the system account has no credits ($0.00). Use your own key below to unlock.</div>
                            )}
                            {customApiKey && (
                                <div className={`text-[10px] mt-1 font-medium ${isPaidLocked ? 'text-red-500' : 'text-blue-600'}`}>
                                    {checkingKey ? 'Checking key...' : isPaidLocked ? 'Custom Key has insufficient credits.' : 'Custom API Key active. Paid models unlocked.'}
                                </div>
                            )}
                            {credits !== null && credits > 0 && (
                                <div className="text-[10px] text-green-600 mt-1 flex items-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1"></div>
                                    Credits available: ${credits.toFixed(2)}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Moderator Voice</label>
                        <div className="flex space-x-2">
                            <select
                            className="w-full h-10 p-2 border border-gray-300 rounded text-sm"
                            value={settings.moderator_voice}
                            onChange={e => setSettings({...settings, moderator_voice: e.target.value})}
                            >
                            <option value="">Default Browser Voice</option>
                            {voices.filter(v => v.lang.startsWith(getLangCode(settings.language))).map((v, i) => (
                                <option key={i} value={v.name}>{v.name.length > 30 ? v.name.slice(0,30)+'...' : v.name}</option>
                            ))}
                            {/* Fallback: Show others if needed or label group */}
                            <optgroup label="Other Languages">
                                    {voices.filter(v => !v.lang.startsWith(getLangCode(settings.language))).map((v, i) => (
                                    <option key={i} value={v.name}>{v.name.length > 30 ? v.name.slice(0,30)+'...' : v.name} ({v.lang})</option>
                                    ))}
                            </optgroup>
                            </select>
                            <button
                                type="button"
                                onClick={() => previewVoice(settings.moderator_voice, "Welcome to the debate.")}
                                className="h-10 w-10 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-200"
                                title="Preview Voice"
                            >
                                <Volume2 className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100 mt-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                     OpenRouter API Key (Optional)
                 </label>
                 
                 {/* Helper Text with Balance Check */}
                 <div className={`text-xs mb-2 transition-colors ${
                    checkingKey ? 'text-gray-500' :
                    (customApiKey && customKeyCredits !== null) ? (customKeyCredits > 0 ? 'text-blue-600' : 'text-red-500') : 'text-gray-500'
                 }`}>
                    {checkingKey ? 'Checking key balance...' : 
                     (customApiKey && customKeyCredits !== null) ? 
                        (customKeyCredits > 0 ? `Custom Key Accepted. Credits: $${customKeyCredits.toFixed(2)}` : `Key has no credits ($0.00). Paid models locked.`) :
                        'Enter your own key to bypass system credit limits and access paid models.'}
                 </div>

                 <input
                    type="password"
                    className="w-full h-10 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    placeholder="sk-or-..."
                    value={customApiKey}
                    onChange={e => setCustomApiKey(e.target.value)}
                 />
            </div>

          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {participants.map((p, idx) => (
             <div key={idx} className="bg-white p-6 rounded-lg shadow border border-gray-200">
               <h2 className="text-xl font-semibold mb-4 text-gray-800">
                   {idx === 0 ? "Participant 1 (Pro)" : idx === 1 ? "Participant 2 (Con)" : `Participant ${idx + 1}`}
               </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                     <div className="flex-shrink-0 flex flex-col items-center space-y-2">
                        <img 
                            src={getAvatarUrl(p.avatar)} 
                            alt="Avatar" 
                            className="w-16 h-16 rounded-full bg-gray-50 border border-gray-200"
                        />
                        <button 
                            type="button"
                            onClick={() => updateParticipant(idx, 'avatar', Math.random().toString(36).substring(7))}
                            className="text-xs text-blue-500 hover:text-blue-700 underline"
                        >
                            Randomize
                        </button>
                     </div>
                     <div className="flex-grow">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          required
                          className="w-full h-10 p-2 border border-gray-300 rounded"
                          value={p.name}
                          onChange={e => updateParticipant(idx, 'name', e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Model</label>
                        <select
                          className="w-full h-10 p-2 border border-gray-300 rounded text-sm"
                          value={p.model}
                          onChange={e => updateParticipant(idx, 'model', e.target.value)}
                        >
                          <optgroup label="Free Models">
                              {models.filter(m => m.is_free).map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({formatContext(m.context_length)})</option>
                              ))}
                          </optgroup>
                          <optgroup label={`Paid Models ${isPaidLocked ? '(Disabled)' : '($ per 1M tokens)'}`}>
                              {models.filter(m => !m.is_free).map(m => (
                                <option key={m.id} value={m.id} disabled={isPaidLocked}>
                                    {m.name} ({formatContext(m.context_length)} | {formatPrice(m.pricing)})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Voice</label>
                         <div className="flex space-x-2">
                            <select
                              className="w-full h-10 p-2 border border-gray-300 rounded text-sm"
                              value={p.voice}
                              onChange={e => updateParticipant(idx, 'voice', e.target.value)}
                            >
                               {voices.filter(v => v.lang.startsWith(getLangCode(settings.language))).map((v, i) => (
                                   <option key={i} value={v.name}>{v.name.length > 25 ? v.name.slice(0,25)+'...' : v.name}</option>
                               ))}
                               <optgroup label="Other Languages">
                                    {voices.filter(v => !v.lang.startsWith(getLangCode(settings.language))).map((v, i) => (
                                       <option key={i} value={v.name}>{v.name.length > 25 ? v.name.slice(0,25)+'...' : v.name} ({v.lang})</option>
                                    ))}
                               </optgroup>
                            </select>
                            <button
                                type="button"
                                onClick={() => previewVoice(p.voice, `Hello, I am ${p.name}`)}
                                className="h-10 w-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 rounded border border-gray-200 shrink-0"
                                title="Preview Voice"
                            >
                                <Volume2 className="w-4 h-4"/>
                            </button>
                        </div>
                      </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700">System Prompt</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenStyleIdx(openStyleIdx === idx ? null : idx);
                                }}
                                className="text-xs flex items-center bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-600 transition-colors"
                            >
                                <ChevronDown className="w-3 h-3 mr-1" /> Choose Style
                            </button>
                            {openStyleIdx === idx && (
                                <div ref={styleRef} className="absolute right-0 top-full mt-1 w-96 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                                    <div className="p-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Select Persona Style</div>
                                    {STYLE_PRESETS.map((style, sIdx) => (
                                        <button
                                            key={sIdx}
                                            type="button"
                                            onClick={() => applyStyle(idx, style.desc)}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b last:border-0 border-gray-50 group"
                                        >
                                            <div className="text-xs font-bold text-gray-800">{style.label}</div>
                                            <div className="text-[10px] text-gray-500 leading-tight">{style.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <textarea
                      rows={4}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      value={p.prompt}
                      onChange={e => updateParticipant(idx, 'prompt', e.target.value)}
                    />
                  </div>
                </div>
              </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || validating}
          className="w-full flex items-center justify-center py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-bold text-lg"
        >
          {validating ? 'Validating Models...' : loading ? 'Starting Debate...' : <><Plus className="w-5 h-5 mr-2"/> Start Debate</>}
        </button>
      </form>
    </div>
  );
};

export default CreateDebate;
