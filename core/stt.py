import asyncio
import numpy as np
import pywhispercpp.model as whisper

class SpeechToText:
    def __init__(self, model_path: str):
        print("Loading Whisper STT Engine...")
        self.model = whisper.Model(model_path)

    async def transcribe_async(self, audio_array: np.ndarray) -> str:
        # Array must be float32 normalized
        audio_float = audio_array.astype(np.float32) / 32768.0
        
        # Run synchronous transcribe in thread pool
        transcription = await asyncio.to_thread(self.model.transcribe, audio_float)
        text = "".join([t.text for t in transcription]).strip()
        return text
