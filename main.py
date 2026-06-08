import os
import asyncio
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Import our new modules
from core.wake import WakeWordDetector
from core.stt import SpeechToText
from core.llm import LanguageModel
from core.tts import TextToSpeech

# Model paths — override with environment variables, otherwise fall back to the
# original local paths. Point these at your own GGUF LLM + Whisper model:
#   CLIPPY_LLM_MODEL      -> path to a .gguf model (e.g. Qwen2.5-Coder)
#   CLIPPY_WHISPER_MODEL  -> path to a ggml/whisper.cpp model
MODEL_PATH = os.environ.get(
    "CLIPPY_LLM_MODEL",
    r"E:\Trebuchet\models\Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf",
)
WHISPER_PATH = os.environ.get(
    "CLIPPY_WHISPER_MODEL",
    r"E:\Trebuchet\models\ggml-small_whisper.bin",
)

# Initialization
wake_detector = WakeWordDetector("hey_jarvis", threshold=0.5)
stt_engine = SpeechToText(WHISPER_PATH)
llm_engine = LanguageModel(MODEL_PATH)
tts_engine = TextToSpeech("pt-BR-AntonioNeural")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def calculate_rms(audio_array):
    return np.sqrt(np.mean(np.square(audio_array, dtype=np.float32)))

import webbrowser

def handle_command(text: str) -> bool:
    """
    Very crude and simple command execution layer.
    Interrupts standard conversational flow if matched.
    """
    lower_text = text.lower()
    
    if "abrir youtube" in lower_text or "toca uma música" in lower_text:
        webbrowser.open("https://youtube.com")
        return True, "Abrindo o YouTube pra você, chefe!"
        
    if "abrir google" in lower_text:
        webbrowser.open("https://google.com")
        return True, "O Google está na tela."
        
    if "Calculadora" in text or "calculadora" in lower_text:
        os.system("calc.exe")
        return True, "Calculadora aberta!"
        
    return False, ""

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Clippy connected to modular backend!")
    
    state = "WAITING"
    command_buffer = []
    silence_frames = 0
    SILENCE_THRESHOLD = 500
    FRAMES_FOR_SILENCE = 20
    
    try:
        sys_context = {}
        while True:
            msg = await websocket.receive()
            
            if "text" in msg and msg["text"]:
                import json
                try:
                    payload = json.loads(msg["text"])
                    if payload.get("action") == "system_context":
                        sys_context = payload.get("context", {})
                    elif payload.get("action") == "force_wake":
                        print("Forced wake from frontend!")
                        await websocket.send_json({"action": "wake"})
                        state = "RECORDING"
                        command_buffer = []
                        silence_frames = 0
                except:
                    pass
                continue
                
            if "bytes" not in msg or not msg["bytes"]:
                continue
                
            data = msg["bytes"]
            audio_array = np.frombuffer(data, dtype=np.int16)
            
            if state == "WAITING":
                if wake_detector.predict(audio_array):
                    print("Magic word detected!")
                    await websocket.send_json({"action": "wake"})
                    state = "RECORDING"
                    command_buffer = []
                    silence_frames = 0
                    
            elif state == "RECORDING":
                command_buffer.append(audio_array)
                rms = calculate_rms(audio_array)
                
                if rms < SILENCE_THRESHOLD:
                    silence_frames += 1
                else:
                    silence_frames = 0
                    
                if silence_frames > FRAMES_FOR_SILENCE:
                    print("Silence detected, processing in background...")
                    await websocket.send_json({"action": "thinking"})
                    
                    full_audio = np.concatenate(command_buffer)
                    
                    # Fire-And-Forget async task so websocket keeps reading
                    async def process_audio(audio_data):
                        # 1. Transcribe
                        user_text = await stt_engine.transcribe_async(audio_data)
                        print(f"User said: {user_text}")
                        
                        # 1.5. Check for Commands Early!
                        is_cmd, cmd_reply = handle_command(user_text)
                        
                        if is_cmd:
                            # Command matched, bypass LLM
                            await websocket.send_json({
                                "action": "reply",
                                "user_text": user_text,
                                "clippy_answer": cmd_reply,
                                "status": "complete"
                            })
                            print(f"Streaming Audio for Command: {cmd_reply}")
                            await tts_engine.generate_and_send_audio(cmd_reply, websocket)
                            return

                        # 2. Generate Reply
                        clippy_response = ""
                        if len(user_text) > 2:
                            await websocket.send_json({
                                "action": "reply",
                                "user_text": user_text,
                                "clippy_answer": "...",
                                "status": "start"
                            })
                            
                            # Inject OS context into the prompt
                            context_prompt = user_text
                            if sys_context:
                                context_prompt = f"[System Context: User is on {sys_context.get('platform')}, Active App: {sys_context.get('activeWindow')}, Time: {sys_context.get('time')}] {user_text}"
                                
                            async for token in llm_engine.generate_stream_async(context_prompt):
                                clippy_response += token
                                await websocket.send_json({
                                    "action": "reply_token",
                                    "token": token
                                })
                        else:
                            user_text = "[Silêncio/Ruído]"
                            clippy_response = "Eu ouvi um barulho, mas não entendi nada. Pode repetir meu chapa?"
                            # For fallbacks just send it immediately
                            await websocket.send_json({
                                "action": "reply",
                                "user_text": user_text,
                                "clippy_answer": clippy_response,
                                "status": "complete"
                            })
                            
                        # Let React know stream finished
                        if len(user_text) > 2:
                            await websocket.send_json({
                                "action": "reply",
                                "user_text": user_text,
                                "clippy_answer": clippy_response,
                                "status": "complete"
                            })
                        
                        # 3. Text to Speech Streaming
                        print(f"Streaming Audio for: {clippy_response}")
                        try:
                            await tts_engine.generate_and_send_audio(clippy_response, websocket)
                        except Exception:
                            print("Socket died during TTS stream")
                            
                        # Send signal to unlock Frontend to WAITING
                        try:
                            await websocket.send_json({"action": "ready"})
                        except Exception:
                            pass

                    # Trigger the processing worker
                    asyncio.create_task(process_audio(full_audio))
                    
                    # Instantly back to avoiding recording more until worker enables later
                    state = "PROCESSING"
                    
            elif state == "PROCESSING":
                 # Block further Wake word listening here if needed or let worker reset to WAITING
                 # For now, frontend handles the block via states, but backend state allows ignoring frames
                 state = "WAITING"
                    
    except WebSocketDisconnect:
        print("Clippy disconnected.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8081)
