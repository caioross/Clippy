import asyncio
import edge_tts
import base64

class TextToSpeech:
    def __init__(self, voice="pt-BR-AntonioNeural"):
        self.voice = voice

    async def generate_and_send_audio(self, text: str, websocket):
        """
        Gearetes audio from text using edge_tts and streams chunk by chunk 
        (base64 encoded) via the provided WebSocket.
        """
        try:
            communicate = edge_tts.Communicate(text, self.voice)
            
            # Stream the audio data as it's being generated
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    # Convert bytes to base64 string for JSON payload
                    b64_audio = base64.b64encode(chunk["data"]).decode('utf-8')
                    await websocket.send_json({
                        "action": "audio",
                        "payload": b64_audio
                    })
        except Exception as e:
            print(f"TTS Error: {e}")
