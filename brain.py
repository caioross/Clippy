import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import openwakeword # <--- Adicionamos o import geral
from openwakeword.model import Model
from llama_cpp import Llama
import pywhispercpp.model as whisper

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminhos baseados na sua pasta de modelos
MODEL_PATH = r"E:\Trebuchet\models\Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf"
WHISPER_PATH = r"E:\Trebuchet\models\ggml-small_whisper.bin"

print("Carregando Modelos. Aguarde...")
stt_model = whisper.Model(WHISPER_PATH)
llm = Llama(model_path=MODEL_PATH, n_ctx=2048, n_gpu_layers=-1)

# --- A MÁGICA PRO WINDOWS ACONTECE AQUI ---
print("Baixando/Verificando modelos do OpenWakeWord (ONNX)...")
openwakeword.utils.download_models() # Garante que os arquivos .onnx vão estar aí

# Forçamos o uso do ONNX para ele esquecer que o tflite existe
oww_model = Model(
    wakeword_models=["hey_jarvis"], 
    inference_framework="onnx"
)
print("Tudo pronto! Aguardando conexão do Clippy...")

def calculate_rms(audio_array):
    """Calcula o volume do áudio para sabermos se você parou de falar"""
    return np.sqrt(np.mean(np.square(audio_array, dtype=np.float32)))

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Clippy conectou os ouvidos!")
    
    state = "WAITING"
    command_buffer = []
    silence_frames = 0
    
    # Configurações de silêncio (ajuste se ele cortar você muito rápido)
    SILENCE_THRESHOLD = 500  # Volume mínimo para considerar que você está falando
    FRAMES_FOR_SILENCE = 20  # Quanto tempo de silêncio para encerrar a frase
    
    try:
        while True:
            # Recebe o áudio cru (PCM 16kHz) direto do Electron
            data = await websocket.receive_bytes()
            audio_array = np.frombuffer(data, dtype=np.int16)
            
            if state == "WAITING":
                # Fica procurando a palavra "Hey Jarvis"
                prediction = oww_model.predict(audio_array)
                
                if prediction['hey_jarvis'] > 0.5:
                    print("Palavra mágica detectada!")
                    await websocket.send_json({"action": "wake"})
                    state = "RECORDING"
                    command_buffer = []
                    silence_frames = 0
                    
            elif state == "RECORDING":
                # Grava tudo que você falar após a palavra mágica
                command_buffer.append(audio_array)
                rms = calculate_rms(audio_array)
                
                # Conta o tempo que você ficou em silêncio
                if rms < SILENCE_THRESHOLD:
                    silence_frames += 1
                else:
                    silence_frames = 0
                    
                # Se ficou em silêncio, processa a inteligência!
                if silence_frames > FRAMES_FOR_SILENCE:
                    print("Silêncio detectado, processando IA...")
                    await websocket.send_json({"action": "thinking"})
                    state = "PROCESSING"
                    
                    # Junta o áudio gravado e converte pro Whisper
                    full_audio = np.concatenate(command_buffer)
                    audio_float = full_audio.astype(np.float32) / 32768.0
                    
                    # --- MÁGICA AQUI: Roda o Whisper em segundo plano ---
                    transcription = await asyncio.to_thread(stt_model.transcribe, audio_float)
                    user_text = "".join([t.text for t in transcription]).strip()
                    print(f"Você disse: {user_text}")
                    
                    if len(user_text) > 2:
                        prompt = f"System: Você é o Clippy. Seja curto e engraçado.\nUser: {user_text}\nAssistant:"
                        
                        # --- MÁGICA AQUI: Roda o LLM em segundo plano ---
                        output = await asyncio.to_thread(llm, prompt, max_tokens=150, stop=["User:"])
                        clippy_response = output["choices"][0]["text"].strip()
                    else:
                        user_text = "[Silêncio]"
                        clippy_response = "Eu ouvi meu nome, mas não entendi o que você disse depois!"
                        
                    await websocket.send_json({
                        "action": "reply",
                        "user_text": user_text,
                        "clippy_answer": clippy_response
                    })
                    
                    # Volta a dormir esperando a próxima palavra mágica
                    state = "WAITING"
                    
    except WebSocketDisconnect:
        print("Clippy desconectou.")
                    
    except WebSocketDisconnect:
        print("Clippy desconectou.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8081)