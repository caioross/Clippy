import asyncio
from llama_cpp import Llama

class LanguageModel:
    def __init__(self, model_path: str):
        print("Loading LLM Engine...")
        self.llm = Llama(model_path=model_path, n_ctx=2048, n_gpu_layers=-1)
        self.history = []
        self.max_history = 5 # Manter o contexto curto para ser rápido

    async def generate_stream_async(self, user_text: str):
        # Build prompt from history
        prompt = "System: Você é o Clippy, um assistente virtual debochado, sarcástico, mas no fundo prestativo. Seja muito curto, direto e engraçado nas repostas.\n\n"
        
        for interaction in self.history:
            prompt += f"User: {interaction['user']}\nAssistant: {interaction['assistant']}\n"
            
        prompt += f"User: {user_text}\nAssistant:"
        
        # Stream response
        full_response = ""
        for chunk in self.llm(prompt, max_tokens=150, stop=["User:"], stream=True):
            token = chunk["choices"][0]["text"]
            full_response += token
            yield token
            # Yield control back to event loop slightly so socket can be sent
            await asyncio.sleep(0) 
            
        # Save to history
        self.history.append({"user": user_text, "assistant": full_response.strip()})
        if len(self.history) > self.max_history:
            self.history.pop(0)
