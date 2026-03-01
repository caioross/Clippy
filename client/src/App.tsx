import React, { useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Assistant3D } from '@/components/Assistant3D';
import { PremiumBubble } from '@/components/PremiumBubble';
import { useAssistantStore } from '@/store';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ContextMenu } from '@/components/ContextMenu';
import hark from 'hark';
import { useAudioQueueStore } from '@/store/audioQueueStore';

export type AssistantState = 'WAITING' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'SCARED' | 'SLEEPY' | 'CONFUSED' | 'HAPPY';

function App() {
  const {
    assistantState,
    setAssistantState,
    bubbleText,
    setBubbleText,
    isSystemActive,
    setIsSystemActive,
    lowPerf
  } = useAssistantStore(state => ({
    assistantState: state.state,
    setAssistantState: state.setState,
    bubbleText: state.bubbleText,
    setBubbleText: state.setBubbleText,
    isSystemActive: state.isSystemActive,
    setIsSystemActive: state.setIsSystemActive,
    lowPerf: state.lowPerformanceMode
  }));

  const enqueueLocalAudio = useAudioQueueStore(state => state.enqueue);

  const wsRef = useRef<WebSocket | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = React.useState({
    isOpen: false,
    x: 0,
    y: 0
  });

  // Handle right click globally
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        isOpen: true,
        x: e.clientX,
        y: e.clientY
      });
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  useEffect(() => {
    // connect to python backend
    const connectWS = () => {
      const ws = new WebSocket('ws://127.0.0.1:8081/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        setIsSystemActive(true);
        setBubbleText({ user: '', clippy: "Sistema de voz premium ativado!\n\nDiga 'Hey Jarvis' a qualquer momento para falar comigo." });
        setTimeout(() => setBubbleText(null), 5000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'wake') {
          setAssistantState('LISTENING');
          setBubbleText({ user: '', clippy: 'Sim? Estou ouvindo...' });
        } else if (data.action === 'thinking') {
          setAssistantState('THINKING');
          setBubbleText({ user: '', clippy: 'Pensando...' });
        } else if (data.action === 'reply') {
          // Status could be 'start' or 'complete'
          if (data.status === 'start') {
            setAssistantState('SPEAKING');
            setBubbleText({ user: data.user_text, clippy: "" }); // Clear for streaming
          } else {
            // Fallback complete or end of stream
            setAssistantState('SPEAKING');
            if (data.clippy_answer) {
              setBubbleText({ user: data.user_text, clippy: data.clippy_answer });
            }
            setTimeout(() => setAssistantState('WAITING'), 3000);
          }
        } else if (data.action === 'reply_token') {
          // Append incoming tokens
          setBubbleText((prev) => {
            if (!prev) return prev;
            return { ...prev, clippy: prev.clippy + data.token };
          });
        } else if (data.action === 'audio') {
          // Received a chunk of TTS audio from the backend
          enqueueLocalAudio(`data:audio/wav;base64,${data.payload}`);
        }
      };

      ws.onclose = () => {
        setIsSystemActive(false);
        setTimeout(connectWS, 3000); // reconnect
      };
    };

    connectWS();

    // Setup Context Polling & Global shortcut (if in electron)
    let contextInterval: any;
    try {
      if (typeof window !== 'undefined' && (window as any).require) {
        const { ipcRenderer } = (window as any).require('electron');

        ipcRenderer.on('global-shortcut-wake', () => {
          setAssistantState('LISTENING');
          setIsSystemActive(true);
          setBubbleText({ user: '', clippy: '[Ativado via Atalho!]' });
          // Optional: tell backend to force wake
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'force_wake' }));
          }
        });

        contextInterval = setInterval(async () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const sysCtx = await ipcRenderer.invoke('get-system-context');
            wsRef.current.send(JSON.stringify({
              action: 'system_context',
              context: sysCtx
            }));
          }
        }, 5000);
      }
    } catch (e) { }

    // Start audio processing with AudioWorklet
    navigator.mediaDevices.getUserMedia({ audio: true }).then(async (stream) => {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      await audioContext.audioWorklet.addModule('/audio-processor.js');
      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'vapi-processor');

      // Setup VAD with hark
      const speechEvents = hark(stream, { threshold: -50 });
      let isSpeaking = false;

      speechEvents.on('speaking', () => {
        isSpeaking = true;
        setAssistantState('LISTENING');
      });

      speechEvents.on('stopped_speaking', () => {
        isSpeaking = false;
        // Send a signal or just wait for backend to process
      });

      workletNode.port.onmessage = (event) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isSpeaking) {
          // Received Int16Array buffer from worklet, only send if speaking
          wsRef.current.send(event.data);
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

    }).catch(err => {
      console.error("Microphone access denied or AudioWorklet failed", err);
      setIsSystemActive(false);
      setAssistantState('CONFUSED');
      setBubbleText({ user: '', clippy: 'Erro ao acessar o microfone! Verifique se está conectado e com permissões ativas no seu sistema operativo.' });
    });

    return () => {
      wsRef.current?.close();
      if (contextInterval) clearInterval(contextInterval);
    };
  }, []);

  return (
    <div
      className="w-screen h-screen relative bg-transparent overflow-hidden font-sans"
    >
      {/* Recording Indicator */}
      {assistantState === 'LISTENING' && (
        <div className="absolute top-4 right-4 w-4 h-4 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)] z-50"></div>
      )}

      {/* Connection Offline Indicator */}
      {!isSystemActive && (
        <div className="absolute top-4 right-4 bg-red-500/80 text-white text-xs px-3 py-1 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1.5 z-50">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          Servidor Offline
        </div>
      )}

      {/* 3D Canvas */}
      <div className="w-full h-full absolute inset-0 pointer-events-none z-10">
        <div className="w-full h-full pointer-events-auto">
          <ErrorBoundary fallback={<div className="text-red-500 bg-white/80 p-4">Erro ao renderizar 3D.</div>}>
            <Suspense fallback={null}>
              <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 10, 7]} intensity={0.8} />
                <Assistant3D state={assistantState} />
                {!lowPerf && (
                  <EffectComposer enabled={true}>
                    <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
                    <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={[0.002, 0.002] as any} />
                  </EffectComposer>
                )}
              </Canvas>
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-20 pointer-events-none w-72">
        <PremiumBubble text={bubbleText} onClose={() => setBubbleText(null)} />
      </div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export default App;
