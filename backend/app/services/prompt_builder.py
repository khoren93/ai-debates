from typing import List, Dict

class PromptBuilder:
    @staticmethod
    def build_system_prompt(role: str, persona: str, style: int) -> str:
        base = f"You are a participant in a debate. Your role is {role}."
        if persona:
            base += f" Your persona is: {persona}."
        
        intensity_map = {
            1: "Be extremely polite, calm, and academic.",
            5: "Be firm, engaging, and persuasive.",
            10: "Be very passionate, dramatic, and intense, but respectful."
        }
        style_desc = intensity_map.get(style, "Be professional.")
        
        base += f"\nStyle instruction: {style_desc}"
        base += "\nKeep your response concise and within the word limit."
        return base

    @staticmethod
    def build_user_prompt(
        topic: str,
        current_round: str,
        last_turns: List[Dict],
        word_limit: int
    ) -> str:
        prompt = f"Topic: {topic}\n"
        prompt += f"Current Round: {current_round}\n"
        prompt += f"Word Limit: {word_limit} words\n\n"
        
        if last_turns:
            prompt += "Context (Recent turns):\n"
            for t in last_turns:
                prompt += f"{t['speaker_name']} ({t['role']}): {t['text'][:200]}...\n"
        else:
            prompt += "This is the start of the debate.\n"
            
        prompt += "\nRespond to the arguments or state your opening position."
        return prompt

prompt_builder = PromptBuilder()
