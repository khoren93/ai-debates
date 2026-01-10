import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Plus, ChevronDown, Volume2, PlayCircle } from 'lucide-react';

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

const TOPIC_TEMPLATES = [
  // --- Tech & Future ---
  { 
    label: "AI Safety", 
    topic: "Is Artificial Intelligence an existential threat to humanity?", 
    desc: "Discuss the potential risks of AGI, alignment problems, and whether strict regulation is necessary to prevent catastrophic outcomes." 
  },
  { 
    label: "Gene Editing", 
    topic: "Should we allow genetic engineering of humans?", 
    desc: "Debate the ethics of CRISPR, 'designer babies', and eliminating genetic diseases vs potential eugenics and inequality." 
  },
  { 
    label: "Space Exploration",
    topic: "Should we prioritize Mars colonization over Earth problems?",
    desc: "Debate the resource allocation between space agencies like NASA/SpaceX and solving immediate issues like climate change and poverty."
  },
  {
    label: "Self-Driving Cars",
    topic: "Who is responsible when an AI car crashes?",
    desc: "Discuss the 'Trolley Problem' in real life, legal liability, and the ethics of delegating life-or-death decisions to algorithms."
  },
  {
    label: "Climate Engineering",
    topic: "Should we use geoengineering to cool the planet?",
    desc: "Analyze the risks of unintended consequences (e.g. weather manipulation) vs the urgency of the climate crisis."
  },
  {
    label: "Transhumanism",
    topic: "Should we use technology to enhance human capabilities?",
    desc: "Discuss the morality of cybernetic implants, potential biological caste systems, and the definition of what it means to be human."
  },

  // --- Society & Culture ---
  { 
    label: "Remote Work", 
    topic: "Is remote work net positive for society?", 
    desc: "Analyze the impact of remote work on productivity, mental health, urban planning, and corporate culture." 
  },
  { 
    label: "Social Media", 
    topic: "Has social media done more harm than good?", 
    desc: "Evaluate the effects of social platforms on political polarization, mental health, community building, and information dissemination." 
  },
  {
    label: "Video Games",
    topic: "Do video games contribute to real-world violence?",
    desc: "Discuss psychological studies, catharsis theory, and the impact of interactive media on behavior."
  },
  {
    label: "Cancel Culture",
    topic: "Is 'Cancel Culture' a form of mob rule or accountability?",
    desc: "Debate whether social ostracization is a necessary tool for justice or a threat to due process and free speech."
  },
  {
    label: "Screen Time",
    topic: "Should parents strictly limit screen time for children?",
    desc: "Discuss digital literacy and educational benefits vs addiction, attention span reduction, and developmental issues."
  },
  {
    label: "Zoos",
    topic: "Are zoos ethical in the 21st century?",
    desc: "Debate conservation and education benefits vs the morality of keeping wild animals in captivity."
  },

  // --- Economics & Politics ---
  { 
    label: "Universal Basic Income", 
    topic: "Should governments implement Universal Basic Income (UBI)?", 
    desc: "Debate the economic feasibility, social impact, and potential for UBI to address wealth inequality and automation-driven job loss." 
  },
  {
    label: "Cryptocurrencies",
    topic: "Are cryptocurrencies the future of finance or a bubble?",
    desc: "Analyze decentralized finance vs traditional banking, environmental impact, stability, and regulatory challenges."
  },
  {
    label: "Cashless Society",
    topic: "Should we move to a completely cashless society?",
    desc: "Analyze efficiency and crime reduction vs loss of privacy, government surveillance, and exclusion of the unbanked."
  },
  {
    label: "Globalization",
    topic: "Has globalization been net positive for the world?",
    desc: "Debate economic growth and poverty reduction vs cultural homogenization, labor exploitation, and wealth disparity."
  },
  {
    label: "Four-Day Work Week",
    topic: "Should the 4-day work week become the standard?",
    desc: "Analyze productivity studies, employee well-being, work-life balance, and economic impact on businesses."
  },
  {
    label: "Automation Tax",
    topic: "Should governments tax robots?",
    desc: "Discuss using robot taxes to fund social programs for workers displaced by automation and AI."
  },

  // --- Law & Ethics ---
  {
    label: "Free Speech",
    topic: "Should there be strict limits on 'Hate Speech'?",
    desc: "Debate the line between protecting minorities from harm and preserving absolute freedom of expression."
  },
  {
    label: "Death Penalty",
    topic: "Should the death penalty be abolished worldwide?",
    desc: "Debate the morality of capital punishment, risk of executing innocents, retribution vs rehabilitation, and deterrence."
  },
  {
    label: "Voting Age",
    topic: "Should the voting age be lowered to 16?",
    desc: "Argue about civic maturity of youth vs their long-term stake in the future (climate change, national debt)."
  },
  {
    label: "Animal Testing",
    topic: "Is animal testing justified for medical progress?",
    desc: "Debate utilitarian ethics of saving human lives vs the rights of animals to not suffer."
  },
  {
    label: "Data Privacy",
    topic: "Is privacy dead in the digital age?",
    desc: "Debate the trade-offs between convenient personalized services/security and mass surveillance capitalism."
  },
  {
    label: "Assisted Suicide",
    topic: "Should assisted suicide be legal for the terminally ill?",
    desc: "Discuss the right to die with dignity vs potential for abuse and the sanctity of life."
  },

  // --- Education & Environment ---
  {
    label: "Nuclear Energy",
    topic: "Is nuclear energy the solution to climate change?",
    desc: "Discuss safety concerns, waste management, and the reliability of nuclear power compared to renewables."
  },
  { 
    label: "Veganism", 
    topic: "Is veganism a moral obligation?", 
    desc: "Discuss environmental impact of the meat industry, animal rights, and global food sustainability." 
  },
  {
    label: "Standardized Testing",
    topic: "Are standardized tests a fair measure of ability?",
    desc: "Evaluate if they objectively measure intelligence or just prioritize rote memorization and disadvantage certain groups."
  },
  {
    label: "Homework",
    topic: "Should schools abolish homework?",
    desc: "Debate the impact on family time and student stress vs reinforcement of learning concepts and discipline."
  },
  {
    label: "Plastics Ban",
    topic: "Should single-use plastics be banned globally?",
    desc: "Analyze the environmental necessity vs economic impact and convenience for consumers and small businesses."
  },
  {
    label: "Private Schools",
    topic: "Should private schools be abolished?",
    desc: "Debate whether private education reinforces class inequality or provides necessary competition and choice."
  }
];

const STYLE_PRESETS = [
    { label: "Neutral / Logical", desc: "Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts." },
    { label: "Respectful / Polite", desc: "Be consistently polite and respectful. Acknowledge valid points from other speakers." },
    { label: "Aggressive / Confrontational", desc: "Be aggressive and confrontational. Attack the opponent's arguments relentlessly and show no mercy." },
    { label: "Sarcastic / Witty", desc: "Use sarcasm, irony, and wit to undermine the opponent's position. Be clever and biting." },
    { label: "Emotional / Passionate", desc: "Appeal to emotion. Use passionate language, vivid anecdotes, and strong feelings." },
    { label: "Rude / Vulgar (NSFW)", desc: "Be raw, rude, and use strong language/profanity if necessary to make a point. Don't hold back." },
    { label: "Academic / Formal", desc: "Use formal, academic language. Cite abstract concepts and theoretical frameworks." },
    { label: "Simple / ELI5", desc: "Explain arguments simply as if to a 5-year-old. Avoid jargon and complex sentences." },
];

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

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
    num_rounds: 3, 
    length_preset: 'short', // short, medium, long
    moderator_model: '',
    moderator_voice: '', // Added voice
    moderator_avatar: 'ModeratorBot',
    num_participants: 2, // 2-5
  });

  const [participants, setParticipants] = useState([
      { name: 'Debater 1', model: '', voice: '', avatar: 'Debater1', prompt: 'You are a skilled debater. Argue in favor of the topic.\n\nStyle: Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts.', position: 1 },
      { name: 'Debater 2', model: '', voice: '', avatar: 'Debater2', prompt: 'You are a skilled debater. Argue against the topic.\n\nStyle: Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts.', position: 2 }
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
      if (newPrompt.includes('Style: ')) {
          newPrompt = newPrompt.replace(/Style: .*$/s, `Style: ${styleDesc}`);
      } else {
          newPrompt = `${newPrompt}\n\nStyle: ${styleDesc}`;
      }
      
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

    try {
      // Determine effective models
      const defaultModModel = settings.moderator_model || (models.length > 0 ? models[0].id : '');
      const modelIdsToValidate = [
          defaultModModel,
          ...participants.map(p => p.model)
      ].filter((v, i, a) => v && a.indexOf(v) === i); // Unique non-empty values

      // Validate Models
      if (modelIdsToValidate.length > 0) {
          const valRes = await api.post('/models/validate', { model_ids: modelIdsToValidate });
          const failures = valRes.data.results.filter((r: any) => r.status !== 'ok');
          
          if (failures.length > 0) {
              const failedIds = failures.map((f: any) => {
                  const m = models.find(md => md.id === f.model_id);
                  return m ? m.name : f.model_id;
              }).join(', ');
              
              alert(`The following models are unresponsive: ${failedIds}. Please select different models.`);
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

            <div className="pt-2 border-t border-gray-100 mt-2 grid md:grid-cols-2 gap-4">
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
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                          </optgroup>
                          <optgroup label={`Paid Models ${credits !== null && credits <= 0 ? '(Disabled due to low credits)' : '($ per 1M tokens)'}`}>
                              {models.filter(m => !m.is_free).map(m => (
                                <option key={m.id} value={m.id} disabled={credits !== null && credits <= 0}>
                                    {m.name} ({formatPrice(m.pricing)})
                                </option>
                              ))}
                          </optgroup>
                        </select>
                        {/* Legend/Helper text */}
                        {credits !== null && credits <= 0 && (
                            <div className="text-[10px] text-gray-500 mt-1">Paid models are disabled because the system account has no credits ($0.00).</div>
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
            
            <div className="pt-2 border-t border-gray-100 mt-2 flex items-center">
                 <div className="mr-4">
                    <img 
                        src={getAvatarUrl(settings.moderator_avatar)} 
                        alt="Moderator Avatar" 
                        className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200"
                    />
                 </div>
                 <button
                    type="button"
                    onClick={() => setSettings({...settings, moderator_avatar: Math.random().toString(36).substring(7)})}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                 >
                    Randomize Avatar
                 </button>
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
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                          </optgroup>
                          <optgroup label={`Paid Models ${credits !== null && credits <= 0 ? '(Disabled)' : '($ per 1M tokens)'}`}>
                              {models.filter(m => !m.is_free).map(m => (
                                <option key={m.id} value={m.id} disabled={credits !== null && credits <= 0}>
                                    {m.name} ({formatPrice(m.pricing)})
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
