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

// Redis Message Types
export interface ScoreMessage {
  type: 'SCORE';
  payload: CameraScore;
}

export interface SwitchMessage {
  type: 'SWITCH';
  payload: SwitchDecision;
}

export interface NarrationMessage {
  type: 'NARRATION';
  payload: NarrationResult;
}

export type RedisMessage = ScoreMessage | SwitchMessage | NarrationMessage;

// LiveKit Types
export interface LiveKitRoomConfig {
  name: string;
  emptyTimeout: number;
  maxParticipants: number;
}

export interface LiveKitTokenGrant {
  roomJoin: boolean;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  hidden?: boolean;
  room?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Event Types for Telemetry
export interface SwitchEvent {
  id: string;
  timestamp: number;
  fromCam: string;
  toCam: string;
  reason: string;
  deltaScore: number;
  manualOverride: boolean;
}

export interface AnalysisEvent {
  id: string;
  timestamp: number;
  camId: string;
  processingTimeMs: number;
  yoloLatencyMs: number;
  vlmLatencyMs?: number;
  whisperLatencyMs: number;
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
