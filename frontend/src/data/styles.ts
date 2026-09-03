export interface PersonaStyle {
  id: string;
  label: string; // chip label
  full: string; // long label
  desc: string; // appended to the system prompt as "Style: …"
}

export const STYLE_PRESETS: PersonaStyle[] = [
  { id: 'neutral', label: 'Neutral', full: 'Neutral / Logical', desc: 'Maintain a neutral, objective, and logical tone. Avoid emotional language and focus on facts.' },
  { id: 'polite', label: 'Polite', full: 'Respectful / Polite', desc: 'Be consistently polite and respectful. Acknowledge valid points from other speakers.' },
  { id: 'aggressive', label: 'Aggressive', full: 'Aggressive / Confrontational', desc: "Be aggressive and confrontational. Attack the opponent's arguments relentlessly and show no mercy." },
  { id: 'sarcastic', label: 'Sarcastic', full: 'Sarcastic / Witty', desc: "Use sarcasm, irony, and wit to undermine the opponent's position. Be clever and biting." },
  { id: 'passionate', label: 'Passionate', full: 'Emotional / Passionate', desc: 'Appeal to emotion. Use passionate language, vivid anecdotes, and strong feelings.' },
  { id: 'academic', label: 'Academic', full: 'Academic / Formal', desc: 'Use formal, academic language. Cite abstract concepts and theoretical frameworks.' },
  { id: 'simple', label: 'ELI5', full: 'Simple / ELI5', desc: 'Explain arguments simply as if to a 5-year-old. Avoid jargon and complex sentences.' },
  { id: 'rude', label: 'Rude', full: 'Rude / Vulgar (NSFW)', desc: "Be raw, rude, and use strong language/profanity if necessary to make a point. Don't hold back." },
];

/** Replace (or append) the "Style: …" line of a system prompt. */
export const applyStyle = (prompt: string, style: PersonaStyle) =>
  prompt.includes('Style:') ? prompt.replace(/Style:[\s\S]*$/, `Style: ${style.desc}`) : `${prompt.trim()}\n\nStyle: ${style.desc}`;

/** Which preset a prompt currently uses, if any. */
export const detectStyle = (prompt: string) => STYLE_PRESETS.find((s) => prompt.includes(s.desc)) ?? null;
