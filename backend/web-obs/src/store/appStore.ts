import { create } from 'zustand';
import { CameraScore, SwitchDecision, SystemConfig } from '@ai-obs/types';

interface AppState {
  // Configuration
  config: SystemConfig | null;
  setConfig: (config: SystemConfig) => void;

  // Camera scores
  scores: Map<string, CameraScore>;
  updateScore: (score: CameraScore) => void;

  // Program state
  currentProgram: string | null;
  lastSwitch: SwitchDecision | null;
  setCurrentProgram: (cam: string) => void;
  setLastSwitch: (decision: SwitchDecision) => void;

  // Manual override
  manualMode: boolean;
  setManualMode: (manual: boolean) => void;

  // Narration
  narrationEnabled: boolean;
  toggleNarration: () => void;

  // WebSocket connection
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Config
  config: null,
  setConfig: (config) => set({ config }),

  // Scores
  scores: new Map(),
  updateScore: (score) =>
    set((state) => {
      const newScores = new Map(state.scores);
      newScores.set(score.camId, score);
      return { scores: newScores };
    }),

  // Program
  currentProgram: null,
  lastSwitch: null,
  setCurrentProgram: (cam) => set({ currentProgram: cam }),
  setLastSwitch: (decision) => set({ lastSwitch: decision }),

  // Manual mode
  manualMode: false,
  setManualMode: (manual) => set({ manualMode: manual }),

  // Narration
  narrationEnabled: true,
  toggleNarration: () => set((state) => ({ narrationEnabled: !state.narrationEnabled })),

  // WebSocket
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
