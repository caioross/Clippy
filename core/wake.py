import numpy as np
import openwakeword
from openwakeword.model import Model

class WakeWordDetector:
    def __init__(self, wakeword="hey_jarvis", threshold=0.5):
        print("Baixando/Verificando modelos do OpenWakeWord (ONNX)...")
        openwakeword.utils.download_models() # Garante os modelos padrão
        self.model = Model(wakeword_models=[wakeword], inference_framework="onnx")
        self.target_word = wakeword
        self.threshold = threshold
        self.buffer = np.array([], dtype=np.int16)

    def predict(self, audio_array: np.ndarray) -> bool:
        # OpenWakeWord is optimized for 1280 sample chunks (80ms at 16kHz)
        self.buffer = np.concatenate((self.buffer, audio_array))
        
        if len(self.buffer) >= 1280:
            chunk_to_process = self.buffer[:1280]
            self.buffer = self.buffer[1280:] # keep remainder
            prediction = self.model.predict(chunk_to_process)
            return prediction.get(self.target_word, 0.0) > self.threshold
        
        return False
