import { create } from 'zustand';

export type AssistantState = 'WAITING' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'SCARED' | 'SLEEPY' | 'CONFUSED' | 'HAPPY';

interface AssistantStore {
    // Core AI states
    state: AssistantState;
    setState: (state: AssistantState) => void;

    // Communication
    bubbleText: { user: string; clippy: string } | null;
    setBubbleText: (text: { user: string; clippy: string } | null | ((prev: { user: string; clippy: string } | null) => { user: string; clippy: string } | null)) => void;

    // System status
    isSystemActive: boolean;
    setIsSystemActive: (isActive: boolean) => void;

    // Settings
    lowPerformanceMode: boolean;
    togglePerformanceMode: () => void;
}

export const useAssistantStore = create<AssistantStore>((set) => ({
    state: 'WAITING',
    setState: (state) => set({ state }),

    bubbleText: null,
    setBubbleText: (updater) => set((state) => ({
        bubbleText: typeof updater === 'function' ? updater(state.bubbleText) : updater
    })),

    isSystemActive: false,
    setIsSystemActive: (isSystemActive) => set({ isSystemActive }),

    lowPerformanceMode: false,
    togglePerformanceMode: () => set((state) => ({ lowPerformanceMode: !state.lowPerformanceMode })),
}));
