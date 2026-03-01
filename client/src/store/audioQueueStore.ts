import { create } from 'zustand';

interface AudioQueueState {
    queue: string[]; // Base64 or Blob URLs
    isPlaying: boolean;
    currentAudio: HTMLAudioElement | null;
    audioContext: AudioContext | null;
    analyser: AnalyserNode | null;
    panner: PannerNode | null;
    getFrequencyData: () => Uint8Array | null;
    setPannerPosition: (x: number, y: number, z: number) => void;
    enqueue: (audioUrl: string) => void;
    playNext: () => void;
    clear: () => void;
}

export const useAudioQueueStore = create<AudioQueueState>((set, get) => {
    // We initialize context lazily upon first playback since browsers require user gesture
    return {
        queue: [],
        isPlaying: false,
        currentAudio: null,
        audioContext: null,
        analyser: null,
        panner: null,

        getFrequencyData: () => {
            const { analyser } = get();
            if (!analyser) return null;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            return dataArray;
        },

        setPannerPosition: (x, y, z) => {
            const { panner } = get();
            if (panner) {
                if (panner.positionX) {
                    panner.positionX.value = x;
                    panner.positionY.value = y;
                    panner.positionZ.value = z;
                } else {
                    panner.setPosition(x, y, z);
                }
            }
        },

        enqueue: (audioUrl) => {
            set((state) => ({ queue: [...state.queue, audioUrl] }));
            // Auto-play if not currently playing
            if (!get().isPlaying) {
                get().playNext();
            }
        },

        playNext: () => {
            const { queue } = get();
            if (queue.length === 0) {
                set({ isPlaying: false, currentAudio: null });
                return;
            }

            const nextUrl = queue[0];
            const audio = new Audio(nextUrl);

            audio.onended = () => {
                get().playNext();
            };

            audio.onerror = () => {
                console.error("Audio Playback Error in Queue");
                get().playNext(); // skip broken chunk
            };

            // Lazy initialize AudioContext & Analyser (requires user gesture, which should have happened by now)
            let { audioContext, analyser, panner } = get();
            if (!audioContext) {
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                analyser = audioContext.createAnalyser();
                analyser.fftSize = 64; // High freq bins

                panner = audioContext.createPanner();
                panner.panningModel = 'HRTF';
                panner.distanceModel = 'inverse';
                panner.refDistance = 1;
                panner.maxDistance = 10000;
                panner.rolloffFactor = 1;

                set({ audioContext, analyser, panner });
            }

            try {
                // Must be anonymous to allow analysis
                audio.crossOrigin = "anonymous";
                const source = audioContext.createMediaElementSource(audio);
                source.connect(analyser!);
                analyser!.connect(panner!);
                panner!.connect(audioContext.destination);
            } catch (e) {
                console.warn("MediaElementSource connection failed or already exists.", e);
            }

            set((state) => ({
                queue: state.queue.slice(1),
                isPlaying: true,
                currentAudio: audio
            }));

            audio.play().catch(console.error);
        },

        clear: () => {
            const { currentAudio } = get();
            if (currentAudio) {
                currentAudio.pause();
                currentAudio.src = '';
            }
            set({ queue: [], isPlaying: false, currentAudio: null });
        }
    };
});
