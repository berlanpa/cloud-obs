// Backend API Types - copied from AI-Native-Cloud-OBS backend

// Camera and Stream Types
export interface CameraConfig {
  id: string;
  name: string;
  trackId?: string;
  enabled: boolean;
  position?: 'wide' | 'close' | 'medium' | 'overhead' | 'side';
}

// Detection and Analysis Types
export interface YOLODetection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x, y, width, height]
  centroid?: [number, number];
  velocity?: number;
}

export interface VLMResult {
  caption: string;
  tags: string[];
  confidence: number;
  timestamp: number;
}

export interface WhisperSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
  keywords?: string[];
  entities?: string[];
}

export interface AudioFeatures {
  energyDb: number;
  speechPresent: boolean;
  speakerChange: boolean;
}

// Feature and Score Types
export interface CameraFeatures {
  camId: string;
  timestamp: number;

  // Object detection features
  objectCounts: Record<string, number>;
  faceConfMax: number;
  faceArea: number;
  bboxOccupancy: number;
  motionScore: number;

  // Audio features
  speechEnergyDb: number;
  keywords: string[];

  // VLM features
  vlmTags: string[];
  vlmCaption?: string;

  // Computed scores
  faceSalience: number;
  mainSubjectOverlap: number;
  motionSalience: number;
  speechEnergy: number;
  keywordBoost: number;
  framingScore: number;
  noveltyDecay: number;
  continuityBonus: number;
}

export interface CameraScore {
  camId: string;
  timestamp: number;
  score: number;
  features: CameraFeatures;
  reason: string;
}

// Decision and Switching Types
export interface SwitchDecision {
  timestamp: number;
  action: 'SWITCH' | 'HOLD';
  toCam?: string;
  fromCam?: string;
  holdSec?: number;
  rationale: string;
  deltaScore?: number;
  confidence: number;
}

export interface SwitchPolicy {
  minHoldSec: number;
  cooldownSec: number;
  deltaSThreshold: number;
  maxShotDurationSec: number;
  enableHysteresis: boolean;
  enableCooldown: boolean;
  enableSpeechAlign: boolean;
}

// Narration Types
export interface NarrationContext {
  timestamp: number;
  timeWindow: [number, number]; // [start, end] in seconds
  chosenCam: string;
  vlmTags: string[];
  yoloTop: string[];
  whisperDelta: string;
  reason: string;
  safety: {
    pii: boolean;
    profanity: boolean;
  };
}

export interface NarrationRequest {
  context: NarrationContext;
  maxWords: number;
  style?: 'neutral' | 'energetic' | 'calm';
}

export interface NarrationResult {
  text: string;
  durationMs: number;
  timestamp: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// WebSocket Event Types
export interface WSEvent {
  type: 'switch' | 'score' | 'narration' | 'status' | 'error';
  payload: any;
  timestamp: number;
}

// Configuration Types
export interface SystemConfig {
  cameras: CameraConfig[];
  policy: SwitchPolicy;
  vlm: {
    enabled: boolean;
    model: string;
    intervalMs: number;
  };
  yolo: {
    model: string;
    confidenceThreshold: number;
  };
  whisper: {
    model: string;
    language: string;
  };
  narration: {
    enabled: boolean;
    voiceId: string;
    maxWords: number;
  };
}

// LiveKit Token Request
export interface TokenRequest {
  identity: string;
  room: string;
  role: 'camera' | 'viewer' | 'producer';
}

export interface TokenResponse {
  token: string;
  url: string;
}
