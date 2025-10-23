# AI-OBS: 5-Camera Auto-Director Integration Plan

## Executive Summary

This document provides a comprehensive plan for integrating the cloned repositories into the existing AI-OBS codebase to create a production-ready, real-time 5-camera auto-director system with AI-powered switching, scene understanding, and ElevenLabs narration.

**Status**: Research completed, ready for implementation
**Target Latency**: 1.5-2.5 seconds glass-to-glass
**Current Stack**: Node.js/TypeScript services + Python GPU workers + React/Next.js UI

---

## 1. CURRENT ARCHITECTURE ASSESSMENT

### 1.1 Existing Components (Already Built)

#### **Services Layer** (Node.js/TypeScript + Fastify)
- ✅ **API Gateway** (`services/api-gateway/`) - Port 3000
  - LiveKit token generation
  - WebSocket event broadcasting
  - Configuration management

- ✅ **Decision Service** (`services/decision-service/`) - Port 3001
  - Camera switching logic with hysteresis (2s min hold)
  - Cooldown management (4s)
  - Ping-pong detection
  - Delta threshold enforcement (ΔS > 0.15)

- ✅ **TTS Orchestrator** (`services/tts-orchestrator/`) - Port 3002
  - ElevenLabs API integration
  - Narration generation from context
  - Safety/PII filtering

- ✅ **Program Producer** (`services/program-producer/`) - Port 3003
  - Program feed state management
  - Track switching commands (stub)

#### **Workers Layer** (Python + CUDA)
- ✅ **Analysis Worker** (`workers/analysis-worker/`)
  - YOLOv8n object detection
  - Moondream VLM for scene understanding
  - Faster-Whisper ASR
  - CameraRanker with 8-weighted features

#### **Frontend** (Next.js 14 + React 18)
- ✅ **Web-OBS UI** (`web-obs/`)
  - LiveKit client integration
  - Multi-camera grid
  - Program monitor
  - Manual override controls
  - Real-time stats

#### **Infrastructure**
- ✅ Redis (pub/sub messaging)
- ✅ PostgreSQL (config/events)
- ✅ ClickHouse (analytics)
- ✅ Prometheus + Grafana (monitoring)

#### **Shared Types** (`shared/types/`)
- ✅ Comprehensive TypeScript type system (222 lines)
- Camera configs, detections, scores, decisions, narration

---

## 2. CLONED REPOSITORIES ANALYSIS

### 2.1 Repository Purposes & Integration Points

| Repository | Size | Purpose | Integration Target |
|------------|------|---------|-------------------|
| **LiveKit Server** | 5.7 MB | WebRTC SFU, room management | Replace/augment current LiveKit setup |
| **LiveKit React** | 1.2 MB | React hooks & components | Enhance `web-obs/` UI |
| **Ultralytics YOLO** | 12 MB | Object detection (v8/v10/v11) | Replace/enhance `analysis-worker` YOLO |
| **LLaVA VLM** | 34 MB | Vision-language model | Replace Moondream in `analysis-worker` |
| **Faster-Whisper** | 43 MB | Streaming ASR | Enhance `analysis-worker` ASR |
| **ByteTrack** | 128 MB | Multi-object tracking | NEW: Add tracking layer |
| **FFmpeg** | 129 MB | Compositing/WHIP | NEW: Program feed compositor |
| **Redis** | 26 MB | Messaging/streams | Already in use (keep existing) |
| **MeloTTS** | 28 MB | Open-source TTS | Fallback for ElevenLabs |
| **XGBoost** | 16 MB | Gradient boosting | NEW: ML-based ranker |

---

## 3. INTEGRATION ARCHITECTURE

### 3.1 System-Wide Data Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│  5 Cameras (WebRTC Publishers) → LiveKit Server                         │
└──────────────┬───────────────────────────────────────────────────────────┘
               │
               ├──────────────► Web-OBS UI (LiveKit React)
               │                 - All camera previews
               │                 - Program monitor
               │                 - Manual override
               │
               ├──────────────► Analysis Worker (GPU)
               │                 ┌────────────────────────────────┐
               │                 │ For each camera (10 FPS):      │
               │                 │  1. YOLO (Ultralytics)         │
               │                 │  2. ByteTrack (continuity)     │
               │                 │  3. VLM (LLaVA @700ms)         │
               │                 │  4. Whisper (Faster-Whisper)   │
               │                 │  5. Feature Fusion             │
               │                 │  6. XGBoost Ranker             │
               │                 └────────┬───────────────────────┘
               │                          │
               │                          ▼
               │                    Redis (scores.stream)
               │                          │
               │                          ▼
               │                    Decision Service
               │                     (Hysteresis + Rules)
               │                          │
               │                          ├───► TTS Orchestrator
               │                          │     (ElevenLabs / MeloTTS)
               │                          │            │
               │                          ▼            ▼
               │                    Program Producer  Commentary Track
               │                          │
               │                          ▼
               └──────────────► FFmpeg Compositor
                                 (Overlays + WHIP Publish)
                                          │
                                          ▼
                                    Program Feed (LiveKit)
```

### 3.2 Latency Budget Breakdown

| Stage | Current | Target | Component |
|-------|---------|--------|-----------|
| WebRTC ingestion | 200-400ms | 200-400ms | LiveKit Server |
| Frame sampling | ~10ms | ~10ms | Analysis Worker |
| YOLO detection | ~50ms | 5-8ms | **Ultralytics (TensorRT)** |
| ByteTrack (NEW) | N/A | ~5-10ms | **ByteTrack** |
| VLM analysis | ~1000ms | 500-700ms | **LLaVA-7B-4bit** |
| Whisper ASR | ~200ms | 80-150ms | **Faster-Whisper** |
| Ranking | ~20ms | ~20ms | Ranker (+ XGBoost) |
| Decision | ~100ms | ~100ms | Decision Service |
| TTS generation | ~400ms | 150-400ms | ElevenLabs |
| Composition | N/A | 50-150ms | **FFmpeg** |
| **Total** | **~2.4s** | **1.5-2.5s** | ✓ Achievable |

---

## 4. DETAILED INTEGRATION PLAN BY COMPONENT

### 4.1 LiveKit Server Integration

#### **Current State**
- External LiveKit server (managed or self-hosted)
- API Gateway generates tokens using `livekit-server-sdk`
- No direct server control

#### **Integration Strategy**
**Option A: Keep External (Recommended for MVP)**
- Continue using managed LiveKit Cloud or existing deployment
- Benefit: Simpler, battle-tested infrastructure
- Trade-off: Less control over server-side processing

**Option B: Self-Host with Custom Extensions**
- Deploy `livekit/` codebase with custom server-side participants
- Enable direct access to media tracks at server level
- Use case: Advanced compositing, lower latency

#### **Action Items**
1. **Evaluate current LiveKit setup**
   - Check version compatibility with `livekit-react` components
   - Verify simulcast support (critical for 360p analysis streams)

2. **Configure room settings** (via API or config)
   ```yaml
   room:
     enabled_codecs:
       - mime: video/vp8
       - mime: video/h264
     enable_simulcast: true  # CRITICAL
     max_participants: 100
   ```

3. **Token grants for analysis worker**
   ```typescript
   const grants = {
     video: {
       canSubscribe: true,
       canPublish: false,  // Analysis only
     },
     hidden: true,  // Don't show in participant list
   };
   ```

4. **Implement server-side participant** (if self-hosting)
   - Subscribe to all 5 camera tracks (360p simulcast layer)
   - Forward to analysis worker via shared memory or network

#### **Files to Modify**
- `services/api-gateway/src/index.ts` - Token generation
- `docker-compose.yml` - Add LiveKit container (if self-hosting)

---

### 4.2 LiveKit React UI Enhancements

#### **Current State**
- `web-obs/` uses `@livekit/components-react` ^1.4.0
- Basic hooks: likely custom implementation
- Components: `CameraGrid`, `ProgramMonitor`, `ControlPanel`, `StatsPanel`

#### **Integration from `ui/livekit-react/`**

**Key Hooks to Adopt:**
1. **`useRoom()`** - Replace custom room management
   - Provides: `connect()`, `isConnecting`, `participants[]`, `audioTracks[]`
   - Auto-manages all RoomEvent listeners

2. **`useParticipant()`** - Enhanced participant state
   - Provides: `isSpeaking`, `connectionQuality`, `publications[]`
   - Tracks mute/unmute, metadata changes

3. **`useMediaDeviceSelect()`** - Device enumeration (NEW)
   - Camera/mic selection
   - Device change detection

**Components to Integrate:**
1. **`VideoRenderer`** - Low-level video attachment
   - Replace any custom video element management
   - Auto-mirror local cameras
   - Handle resize events

2. **`ParticipantView`** - High-level participant tile
   - Includes overlays (name, connection quality, speaking indicator)
   - Shows bitrate/dimensions
   - Aspect ratio handling

3. **`GridStage` / `SpeakerStage`** - Layout components
   - Intelligent participant sorting (speakers first)
   - Responsive grid sizing (1x1 → 5x5)
   - Sidebar thumbnails for speaker view

4. **`ControlsView`** - Unified controls
   - Mute/unmute + device selection
   - Camera toggle + device selection
   - Screen share toggle

#### **Action Items**
1. **Install dependencies**
   ```bash
   cd web-obs
   npm install @livekit/components-react@latest livekit-client@latest
   ```

2. **Adopt hooks pattern**
   - Replace `web-obs/src/store/appStore.ts` state with `useRoom()` and `useParticipant()`
   - Migrate WebSocket event handling to LiveKit native events

3. **Enhance `CameraGrid` component**
   - Use `GridStage` or custom renderer with `ParticipantView`
   - Add connection quality indicators
   - Show per-camera score overlays (from Redis)

4. **Enhance `ProgramMonitor`**
   - Use `VideoRenderer` with larger size
   - Add transition effects (fade/cut)
   - Display current switch reason

5. **Add manual camera select**
   - Click preview → lock program to that camera
   - Auto-resume after timeout
   - Pause scoring while locked

#### **Files to Create/Modify**
- `web-obs/src/hooks/useLiveKit.ts` (NEW) - Wrapper around `useRoom`
- `web-obs/src/components/CameraGrid.tsx` - Enhance with LiveKit components
- `web-obs/src/components/ProgramMonitor.tsx` - Use `VideoRenderer`
- `web-obs/src/components/CameraPreview.tsx` - Adopt `ParticipantView`

---

### 4.3 Analysis Worker: YOLO Enhancement

#### **Current State**
- `workers/analysis-worker/src/models/yolo_detector.py`
- Uses: `ultralytics.YOLO("yolov8n.pt")`
- Inference: `~50ms` per frame @640x360

#### **Integration from `workers/detection/ultralytics/`**

**Improvements:**
1. **Upgrade to YOLOv11n** (latest, faster)
   ```python
   from ultralytics import YOLO
   model = YOLO("yolo11n.pt")  # or yolo11s.pt for better accuracy
   ```

2. **TensorRT Optimization** (5-8ms target)
   ```python
   # Export to TensorRT once
   model.export(format="engine", half=True, device=0, workspace=4)

   # Load optimized engine
   model = YOLO("yolo11n.engine")
   ```

3. **Batch Processing** (process 5 cameras together)
   ```python
   # Stack all 5 camera frames
   batch_frames = [cam1_frame, cam2_frame, ...]  # 5 x [360, 640, 3]
   results = model(batch_frames, stream=False, verbose=False)

   for cam_id, result in enumerate(results):
       detections = result.boxes.data  # [N, 6] (x1,y1,x2,y2,conf,cls)
   ```

4. **Class-specific tracking**
   - Focus on: `person`, `face` (if custom), `car`, `ball`, etc.
   - Filter out low-priority objects (e.g., `bench`, `backpack`)

#### **Action Items**
1. **Update model**
   - Download YOLO11n weights: `yolo task=detect mode=predict model=yolo11n.pt`
   - Export to TensorRT for target GPU (A10/L4/RTX)

2. **Refactor `yolo_detector.py`**
   - Add batch processing support
   - Return structured detections with centroids, velocities

3. **Add velocity computation** (for motion salience)
   ```python
   # Track centroids between frames
   prev_centroids = {}
   velocity = (current_centroid - prev_centroid) / dt
   ```

4. **Integrate face detection**
   - Option A: Use YOLO with custom face dataset
   - Option B: Add separate face detector (e.g., RetinaFace, SCRFD)

#### **Files to Modify**
- `workers/analysis-worker/src/models/yolo_detector.py`
- `workers/analysis-worker/requirements.txt` - Update ultralytics version
- `workers/analysis-worker/Dockerfile` - Add TensorRT export step

---

### 4.4 Analysis Worker: LLaVA VLM Integration

#### **Current State**
- Uses Moondream VLM (lightweight)
- Inference: ~1000ms per frame
- Runs periodically (every 700ms)

#### **Integration from `workers/vlm/llava/`**

**Replacement Strategy:**
1. **Model Selection: LLaVA-1.5-7B (4-bit quantization)**
   - Speed: 600-700ms per frame (vs 1000ms Moondream)
   - Quality: Superior scene understanding
   - VRAM: ~5GB (fits RTX 3090, A10)

2. **Initialization**
   ```python
   from llava.model.builder import load_pretrained_model

   tokenizer, model, image_processor, context_len = load_pretrained_model(
       model_path="liuhaotian/llava-v1.5-7b",
       model_name="llava-v1.5-7b",
       load_4bit=True,  # Critical for speed
       device_map="auto",
       use_flash_attn=True
   )
   ```

3. **Optimized Prompt for Camera Ranking**
   ```python
   prompt = """Analyze this camera frame. Provide:
   1. Scene type (indoor/outdoor/stage/field)
   2. Main subjects (people/objects/vehicles)
   3. Activity level (static/moderate/dynamic)
   4. Focus quality (blurry/clear/excellent)
   5. Interest score (1-5)

   Format: JSON"""
   ```

4. **Batch Processing** (optional, for offline analysis)
   - Process 2-4 frames together
   - Trade-off: 2x throughput vs 1.5x latency per frame

#### **Action Items**
1. **Install LLaVA dependencies**
   ```bash
   cd workers/vlm/llava
   pip install -e .
   pip install flash-attn --no-build-isolation
   ```

2. **Replace VLM class**
   - Create `workers/analysis-worker/src/models/llava_vlm.py`
   - Implement same interface as existing `vlm.py`

3. **Add model caching**
   - Download model once: `llava-v1.5-7b` (~15GB)
   - Store in `/root/.cache/` (Docker volume)

4. **Structured output parsing**
   ```python
   import json, re

   def extract_json(response):
       match = re.search(r'\{.*\}', response, re.DOTALL)
       return json.loads(match.group()) if match else {}
   ```

5. **Confidence approximation**
   - Use token logits or beam search scores
   - Fall back to rule-based if VLM confidence low

#### **Files to Create/Modify**
- `workers/analysis-worker/src/models/llava_vlm.py` (NEW)
- `workers/analysis-worker/src/config.py` - Add VLM model selection
- `workers/analysis-worker/requirements.txt` - Add LLaVA deps
- `docker-compose.yml` - Update model cache volume

---

### 4.5 Analysis Worker: Faster-Whisper ASR

#### **Current State**
- Uses `faster-whisper` library (already integrated!)
- Model: `base.en` (~140M params)
- Processing: audio chunks with VAD

#### **Enhancement from `workers/asr/faster-whisper/`**

**Optimizations:**
1. **Batched Inference** (NEW in Faster-Whisper)
   ```python
   from faster_whisper import WhisperModel, BatchedInferencePipeline

   model = WhisperModel("turbo", device="cuda", compute_type="float16")
   batched_model = BatchedInferencePipeline(model=model)

   segments, info = batched_model.transcribe("audio.mp3", batch_size=8)
   ```
   - Speed: 17s vs 59s for 13min audio (3.5x faster)

2. **VAD Filter** (reduce processing of silence)
   ```python
   segments, info = model.transcribe(
       audio,
       vad_filter=True,
       vad_parameters=dict(
           min_silence_duration_ms=500,  # More aggressive
           speech_pad_ms=50
       )
   )
   ```

3. **Word-Level Timestamps** (for J-cut/L-cut switching)
   ```python
   segments, _ = model.transcribe(audio, word_timestamps=True)

   for segment in segments:
       for word in segment.words:
           print(f"[{word.start:.2f}s → {word.end:.2f}s] {word.word}")
   ```

4. **Streaming Mode** (for live audio)
   - Use `WhisperLive` integration (from community projects)
   - Or process in sliding windows (250-500ms chunks)

#### **Action Items**
1. **Enable batched inference**
   - Modify `workers/analysis-worker/src/models/whisper_asr.py`
   - Process audio from all 5 cameras together

2. **Add keyword detection**
   ```python
   keywords = ["goal", "applause", "breaking", "announcement", "look"]

   for segment in segments:
       words = segment.text.lower().split()
       detected = [kw for kw in keywords if kw in words]
       if detected:
           score_boost = 0.2  # Boost camera ranking
   ```

3. **Speaker change detection**
   - Track audio energy spikes
   - Detect silence gaps > 1 second
   - Attribute speech to visible speakers (via YOLO face + location)

4. **Integrate with decision service**
   - Don't cut mid-word (use word timestamps)
   - Align cuts to VAD boundaries

#### **Files to Modify**
- `workers/analysis-worker/src/models/whisper_asr.py`
- `workers/analysis-worker/src/config.py` - Add batch size config
- `services/decision-service/src/switcher.ts` - Add speech-aware cutting

---

### 4.6 ByteTrack Integration (NEW Component)

#### **Purpose**
- Multi-object tracking (MOT) for continuity features
- Assigns stable IDs to detected objects across frames
- Provides velocity, trajectory, and persistence data

#### **Integration from `workers/tracking/ByteTrack/`**

**Architecture:**
```
YOLO Detections → ByteTrack → Tracked Objects (with IDs)
```

**Implementation:**
1. **Core Tracker Class**
   ```python
   from yolox.tracker.byte_tracker import BYTETracker, STrack

   tracker = BYTETracker(args, frame_rate=10)  # 10 FPS processing

   # Per frame:
   yolo_results = yolo_model(frame)  # [N, 6] (x1,y1,x2,y2,conf,cls)
   tracks = tracker.update(yolo_results, img_info, img_size)

   # tracks = list of STrack objects
   for track in tracks:
       track_id = track.track_id  # Stable ID
       bbox = track.tlbr  # [x1, y1, x2, y2]
       score = track.score
   ```

2. **Continuity Features for Ranking**
   ```python
   # Track person #42 over time
   if track_id == 42:
       # Subject stayed in frame → continuity bonus
       continuity_score = min(track.tracklet_len / 30, 1.0)  # 0-1

       # Velocity for motion salience
       velocity = track.mean[4:6]  # dx, dy from Kalman filter
       motion_score = np.linalg.norm(velocity) / 10.0  # Normalize
   ```

3. **Main Subject Tracking**
   - Identify "main subject" by:
     - Largest face bbox area
     - Center of frame proximity
     - Longest track duration
   - Boost cameras showing the main subject

#### **Action Items**
1. **Install ByteTrack**
   ```bash
   cd workers/tracking/ByteTrack
   pip install -e .
   ```

2. **Create tracker module**
   - `workers/analysis-worker/src/models/byte_tracker.py` (NEW)
   - Wrapper around `yolox.tracker.byte_tracker.BYTETracker`

3. **Integrate into analysis pipeline**
   ```python
   # In main.py analysis loop:
   yolo_results = yolo_model(frame)
   tracks = byte_tracker.update(yolo_results, ...)

   # Extract continuity features
   main_subject_id = find_main_subject(tracks)
   for cam_id in range(5):
       features[cam_id]['continuity_bonus'] = compute_continuity(
           tracks, main_subject_id
       )
   ```

4. **Tune tracker parameters**
   ```python
   args = argparse.Namespace(
       track_thresh=0.5,   # Detection confidence threshold
       track_buffer=30,    # Frames to keep lost tracks
       match_thresh=0.8,   # IOU threshold for matching
       mot20=False
   )
   ```

#### **Files to Create**
- `workers/analysis-worker/src/models/byte_tracker.py` (NEW)
- `workers/analysis-worker/src/ranker.py` - Add continuity features

---

### 4.7 FFmpeg Compositor Integration (NEW Component)

#### **Purpose**
- Composite program feed with overlays (lower-thirds, logos, timers)
- Publish to LiveKit as virtual camera via WHIP
- Handle transitions (dissolve/cut)

#### **Integration from `compositor/ffmpeg/`**

**Architecture:**
```
Decision Service → FFmpeg → WHIP Publish → LiveKit (Program Track)
```

**Implementation Options:**

**Option A: FFmpeg CLI Pipeline (Simplest)**
```bash
# Subscribe to camera track via WHIP/RTMP
ffmpeg -i rtmp://livekit/camera_3 \
       -i overlay.png \
       -filter_complex "[0:v][1:v]overlay=10:H-h-10" \
       -c:v libx264 -preset ultrafast -tune zerolatency \
       -f rtsp rtsp://livekit/program
```

**Option B: FFmpeg Library (libavcodec) in Node.js**
```typescript
import ffmpeg from 'fluent-ffmpeg';

const compositor = ffmpeg()
  .input('pipe:0')  // Receive from LiveKit
  .videoCodec('libx264')
  .addInput('lower-third.png')
  .complexFilter([
    '[0:v][1:v]overlay=10:H-h-10[out]'
  ])
  .outputOptions([
    '-preset ultrafast',
    '-tune zerolatency',
    '-f rtsp'
  ])
  .output('rtsp://livekit/program')
  .run();
```

**Option C: Server-Side WebRTC Compositor (Most Flexible)**
- Use `livekit-server-sdk` to create server-side participant
- Subscribe to selected camera track
- Render with Canvas API or GPU compositing
- Publish new track back to room

#### **Overlay Elements**
1. **Lower-thirds** (camera name, switch reason)
2. **Logo** (top-right corner)
3. **Timer** (event duration)
4. **Score overlays** (confidence bars, debug mode)
5. **Transitions** (fade in/out on switch)

#### **Action Items**
1. **Create compositor service**
   - `services/compositor/` (NEW)
   - Subscribe to `switch.cmd` Redis channel
   - Pull appropriate camera track from LiveKit

2. **Implement transition effects**
   ```bash
   # Dissolve (crossfade) over 300ms
   ffmpeg -i cam1.mp4 -i cam2.mp4 \
     -filter_complex \
     "xfade=transition=dissolve:duration=0.3:offset=0" \
     output.mp4
   ```

3. **Add overlay assets**
   - `services/compositor/assets/` - PNG overlays, fonts
   - Dynamic text rendering for lower-thirds

4. **WHIP publish integration**
   - Use LiveKit Ingress API to get WHIP endpoint
   - Publish composited stream as new participant

5. **Monitoring**
   - Track frame drops, encoding latency
   - Prometheus metrics: `compositor_latency_ms`, `compositor_fps`

#### **Files to Create**
- `services/compositor/` (NEW directory)
- `services/compositor/src/index.ts` - Main compositor service
- `services/compositor/src/transitions.ts` - Fade/cut logic
- `services/compositor/src/overlays.ts` - Lower-thirds, logos
- `docker-compose.yml` - Add compositor service

---

### 4.8 XGBoost Ranking Enhancement (NEW Component)

#### **Purpose**
- ML-based camera ranking (upgrade from rule-based weights)
- Learn optimal weights from logged switching data
- Adapt to different event types (sports, presentations, concerts)

#### **Integration from `ranker/xgboost/`**

**Architecture:**
```
Historical Data → XGBoost Training → Ranking Model → Real-Time Inference
```

**Implementation:**

**Phase 1: Data Collection (Week 1-2)**
```python
# Log all features + manual switches to ClickHouse
features = {
    'cam_id': 3,
    'face_salience': 0.8,
    'motion_score': 0.3,
    'speech_energy_db': -25.0,
    'keyword_present': True,
    'vlm_interest_score': 4,
    ...
}

label = 1 if cam_was_selected else 0  # Binary classification

# Store: (features, label, timestamp, manual_override)
```

**Phase 2: Model Training (Offline)**
```python
import xgboost as xgb
import pandas as pd

# Load logged data
df = pd.read_sql("SELECT * FROM camera_features WHERE manual_override=false", conn)

X = df[['face_salience', 'motion_score', 'speech_energy_db', ...]]
y = df['was_selected']  # 1 if chosen, 0 otherwise

# Train
dtrain = xgb.DMatrix(X, label=y)
params = {
    'objective': 'binary:logistic',
    'max_depth': 6,
    'eta': 0.1,
    'eval_metric': 'logloss'
}

model = xgb.train(params, dtrain, num_boost_round=100)
model.save_model('camera_ranker.xgb')
```

**Phase 3: Real-Time Inference**
```python
# In workers/analysis-worker/src/ranker.py
import xgboost as xgb

class XGBoostRanker:
    def __init__(self, model_path="camera_ranker.xgb"):
        self.model = xgb.Booster()
        self.model.load_model(model_path)

    def rank(self, features):
        # features: dict with same keys as training
        X = pd.DataFrame([features])
        dmatrix = xgb.DMatrix(X)
        score = self.model.predict(dmatrix)[0]  # 0-1 probability
        return float(score)
```

#### **Action Items**
1. **Add feature logging**
   - Modify `workers/analysis-worker/src/ranker.py`
   - Log all features + decisions to ClickHouse
   - Include manual override flag

2. **Create training pipeline**
   - `ranker/train.py` (NEW) - Fetch data, train model, export
   - Schedule: Daily retraining (cron job or Airflow)

3. **A/B testing**
   - 50% traffic: Rule-based ranker
   - 50% traffic: XGBoost ranker
   - Compare metrics: switch frequency, user satisfaction (ratings)

4. **Model versioning**
   - Store models in S3/GCS with timestamps
   - API to hot-reload new model without restart

5. **Feature importance analysis**
   - Visualize which features drive switches
   - Tune data collection (focus on high-impact features)

#### **Files to Create**
- `ranker/train.py` (NEW) - Training pipeline
- `workers/analysis-worker/src/ranker_xgboost.py` (NEW)
- `services/decision-service/src/feature_logger.ts` (NEW)
- ClickHouse schema for features table

---

### 4.9 MeloTTS Fallback Integration

#### **Purpose**
- Open-source TTS fallback if ElevenLabs unavailable/rate-limited
- Lower quality but zero cost

#### **Integration from `tts/melotts/`**

**Implementation:**
```python
from melo.api import TTS

class TTSOrchestrator:
    def __init__(self):
        self.elevenlabs = ElevenLabsClient()
        self.melo = TTS(language='EN', device='auto')  # Fallback

    def generate_speech(self, text):
        try:
            return self.elevenlabs.generate(text, voice_id="monica")
        except Exception as e:
            logger.warning(f"ElevenLabs failed, using MeloTTS: {e}")
            speaker_ids = self.melo.hps.data.spk2id
            return self.melo.tts_to_file(
                text, speaker_ids['EN-US'], output_path='out.wav'
            )
```

#### **Action Items**
1. **Install MeloTTS**
   ```bash
   cd tts/melotts
   pip install -e .
   ```

2. **Update TTS service**
   - `services/tts-orchestrator/src/narrator.ts` - Add fallback logic
   - Circuit breaker: After 3 ElevenLabs failures, switch to MeloTTS

3. **Quality comparison**
   - A/B test with users
   - Measure latency: MeloTTS (~200-300ms vs ElevenLabs ~150-400ms)

---

## 5. IMPLEMENTATION ROADMAP

### 5.1 Phase 1: Foundation (Week 1-2)

**Goal**: Enhance existing analysis worker with new models

**Tasks**:
1. ✅ Research complete (current step)
2. Upgrade YOLO to YOLOv11n + TensorRT export
3. Integrate LLaVA-7B-4bit for VLM
4. Enable Faster-Whisper batched inference
5. Add ByteTrack for continuity features
6. Update ranker with new feature vectors

**Deliverables**:
- Faster, more accurate detections (~1s latency reduction)
- Richer semantic understanding from LLaVA
- Stable object IDs from ByteTrack

**Testing**:
- Process 5-camera test video
- Measure latency at each stage
- Verify accuracy improvements

---

### 5.2 Phase 2: UI Enhancement (Week 3)

**Goal**: Upgrade web-obs with LiveKit React components

**Tasks**:
1. Integrate `useRoom` and `useParticipant` hooks
2. Replace camera grid with `GridStage` or custom with `ParticipantView`
3. Add connection quality indicators
4. Implement manual camera lock (click-to-select)
5. Add device selection controls

**Deliverables**:
- Production-ready UI with smooth video rendering
- Manual override capability
- Better participant/track management

**Testing**:
- 5 simultaneous browser connections
- Verify video quality selection
- Test manual override flow

---

### 5.3 Phase 3: Composition & Output (Week 4)

**Goal**: Add FFmpeg compositor for program feed

**Tasks**:
1. Create `services/compositor/` service
2. Implement WHIP ingress/egress
3. Add overlay rendering (lower-thirds, logo)
4. Implement fade transitions (300ms dissolve)
5. Publish composite as LiveKit track

**Deliverables**:
- Professional program feed with overlays
- Smooth transitions between cameras
- Single output track for viewers

**Testing**:
- Verify overlay positioning
- Measure composition latency (<150ms)
- Test transition smoothness

---

### 5.4 Phase 4: ML Ranking (Week 5-6)

**Goal**: Train XGBoost model from logged data

**Tasks**:
1. Add feature logging to ClickHouse
2. Collect 1-2 weeks of switching data
3. Label good vs bad switches (manual review or heuristics)
4. Train XGBoost model
5. Deploy model to analysis worker
6. A/B test against rule-based ranker

**Deliverables**:
- ML-powered ranking model
- Improved switching decisions
- Metrics dashboard comparing approaches

**Testing**:
- Compare switch frequency (rule-based vs ML)
- User surveys on switch quality
- Analyze feature importance

---

### 5.5 Phase 5: Optimization & Scale (Week 7-8)

**Goal**: Performance tuning and production hardening

**Tasks**:
1. Optimize GPU utilization (concurrent YOLO + VLM)
2. Add horizontal scaling for analysis workers
3. Implement Redis Streams for reliable messaging
4. Add Prometheus alerts for latency spikes
5. Load testing (10+ simultaneous rooms)
6. Documentation and runbooks

**Deliverables**:
- <2s glass-to-glass latency
- Autoscaling infrastructure
- Production monitoring

**Testing**:
- Stress test with 10 rooms × 5 cameras
- Failover testing (kill worker, kill Redis)
- Latency benchmarks

---

## 6. CRITICAL INTEGRATION DECISIONS

### 6.1 LiveKit Deployment Model

**Decision**: Self-host vs Managed

| Factor | Self-Host | Managed (LiveKit Cloud) |
|--------|-----------|-------------------------|
| Cost | Lower (compute only) | Higher (per-minute pricing) |
| Control | Full server access | Limited |
| Latency | Optimized for setup | Global CDN |
| Ops burden | High (K8s, scaling) | Zero |
| Customization | Server-side participants | Via webhooks only |

**Recommendation**: Start with **Managed (LiveKit Cloud)** for MVP, migrate to self-hosted if:
- Need <200ms latency (edge deployment)
- Want server-side compositing
- Cost exceeds $500/month

---

### 6.2 VLM Model Selection

**Decision**: LLaVA variant

| Model | Speed | Quality | VRAM | Use Case |
|-------|-------|---------|------|----------|
| LLaVA-7B-4bit | 600-700ms | Good | 5GB | **Real-time (recommended)** |
| LLaVA-13B-4bit | 400-500ms | Very good | 8GB | High accuracy |
| LLaVA-34B-4bit | 600-800ms | Excellent | 20GB | Offline/batch only |

**Recommendation**: **LLaVA-7B-4bit** for real-time, upgrade to 13B if GPU budget allows.

---

### 6.3 Compositor Approach

**Decision**: FFmpeg CLI vs Library vs WebRTC

| Approach | Pros | Cons |
|----------|------|------|
| FFmpeg CLI | Simple, battle-tested | Process overhead, latency |
| FFmpeg Library | Programmatic control | Complex integration |
| WebRTC Compositor | Lowest latency | Hardest to implement |

**Recommendation**: Start with **FFmpeg CLI pipeline**, migrate to **WebRTC compositor** if latency >150ms.

---

### 6.4 Ranking Strategy

**Decision**: Rule-based vs ML-based

| Phase | Approach | Rationale |
|-------|----------|-----------|
| Week 1-4 | **Rule-based** | Fast deployment, interpretable |
| Week 5+ | **XGBoost** | Learn from data, adaptive |

**Recommendation**: Deploy rule-based first, collect data, train XGBoost model, A/B test.

---

## 7. RISK MITIGATION

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| VLM latency >1s | Medium | High | Use LLaVA-7B-4bit, skip VLM if backlog |
| GPU OOM | Medium | High | 4-bit quantization, batch size=1 |
| LiveKit token issues | Low | Medium | Robust error handling, token refresh |
| FFmpeg encoding latency | Medium | Medium | Use `ultrafast` preset, hardware encoding |
| XGBoost training data insufficient | High | Low | Start with 1k labeled samples, active learning |

### 7.2 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Worker crash | Medium | High | Auto-restart (k8s liveness probe) |
| Redis down | Low | Critical | Redis Sentinel or managed Redis |
| ElevenLabs rate limit | Medium | Medium | Circuit breaker → MeloTTS fallback |
| Model download failure | Low | High | Pre-cache models in Docker image |
| Switching loop | Low | High | Ping-pong detection already implemented |

---

## 8. MONITORING & OBSERVABILITY

### 8.1 Key Metrics (Prometheus)

**Latency Metrics**:
- `analysis_yolo_latency_ms` - YOLO inference time
- `analysis_vlm_latency_ms` - VLM inference time
- `analysis_whisper_latency_ms` - Whisper transcription time
- `decision_latency_ms` - Decision service response time
- `tts_latency_ms` - TTS generation time
- `compositor_latency_ms` - FFmpeg composition time
- `end_to_end_latency_ms` - Camera ingress → program output

**Quality Metrics**:
- `switch_frequency` - Switches per minute
- `switch_delta_score` - Average ΔS on switch
- `manual_override_rate` - % of manual switches
- `camera_uptime` - % time each camera available
- `vlm_confidence_avg` - Average VLM confidence score

**Resource Metrics**:
- `gpu_utilization_%` - GPU usage
- `gpu_memory_used_mb` - VRAM consumption
- `cpu_usage_%` - CPU per service
- `redis_queue_length` - Message backlog

### 8.2 Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| High latency | `end_to_end_latency_ms > 3000` | Warning |
| Worker crash | No scores received for 10s | Critical |
| GPU OOM | CUDA out of memory error | Critical |
| Rapid switching | `switch_frequency > 6/min` | Warning |
| Low VLM confidence | `vlm_confidence_avg < 0.5` for 5min | Warning |

---

## 9. SUCCESS CRITERIA

### 9.1 Performance Targets

| Metric | Target | Stretch Goal |
|--------|--------|--------------|
| Glass-to-glass latency | <2.5s | <1.5s |
| YOLO inference | <10ms | <5ms |
| VLM inference | <700ms | <500ms |
| Switch frequency | 1-4/min | 2-3/min |
| Manual override rate | <20% | <10% |
| System uptime | 99% | 99.9% |

### 9.2 Quality Targets

- **Switching accuracy**: 80%+ of switches are "interesting" (manual review)
- **Subject continuity**: Main subject tracked across 90%+ of frames
- **Narration relevance**: 90%+ of narrations match scene context
- **Audio sync**: No cuts mid-word (100% speech-aware)

---

## 10. NEXT STEPS

1. **Review this plan** with stakeholders
2. **Set up dev environment**:
   - GPU machine (RTX 3090 / A10 / L4)
   - Docker + docker-compose
   - Access to LiveKit server (cloud or self-hosted)
3. **Begin Phase 1**: YOLO/LLaVA/ByteTrack integration
4. **Weekly check-ins**: Review metrics, adjust priorities
5. **Document learnings**: Update this plan as we discover issues

---

## Appendix A: File Structure After Integration

```
AI-OBS/
├── services/
│   ├── api-gateway/           # ✅ Existing
│   ├── decision-service/      # ✅ Existing
│   ├── tts-orchestrator/      # ✅ Existing (enhance with MeloTTS)
│   ├── program-producer/      # ✅ Existing (enhance with LiveKit SDK)
│   └── compositor/            # 🆕 NEW - FFmpeg compositing
│       ├── src/
│       │   ├── index.ts
│       │   ├── transitions.ts
│       │   └── overlays.ts
│       ├── assets/
│       │   ├── lower-third.png
│       │   └── logo.png
│       └── Dockerfile
│
├── workers/
│   ├── analysis-worker/       # ✅ Existing (major enhancements)
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── models/
│   │   │   │   ├── yolo_detector.py       # 🔄 Upgrade to YOLO11 + TensorRT
│   │   │   │   ├── llava_vlm.py           # 🆕 NEW - Replace Moondream
│   │   │   │   ├── whisper_asr.py         # 🔄 Add batched inference
│   │   │   │   ├── byte_tracker.py        # 🆕 NEW - Object tracking
│   │   │   │   └── ranker_xgboost.py      # 🆕 NEW - ML ranker
│   │   │   └── ranker.py                  # 🔄 Add continuity features
│   │   └── requirements.txt               # 🔄 Update all deps
│   │
│   ├── detection/             # 📦 Cloned: ultralytics (reference)
│   ├── vlm/                   # 📦 Cloned: llava (reference)
│   ├── asr/                   # 📦 Cloned: faster-whisper (reference)
│   └── tracking/              # 📦 Cloned: ByteTrack (reference)
│
├── web-obs/                   # ✅ Existing (enhance with LiveKit React)
│   ├── src/
│   │   ├── hooks/
│   │   │   └── useLiveKit.ts  # 🆕 NEW - Wrapper around useRoom
│   │   ├── components/
│   │   │   ├── CameraGrid.tsx       # 🔄 Use LiveKit components
│   │   │   ├── ProgramMonitor.tsx   # 🔄 Use VideoRenderer
│   │   │   ├── CameraPreview.tsx    # 🔄 Use ParticipantView
│   │   │   └── ControlPanel.tsx     # 🔄 Add manual lock
│   │   └── store/appStore.ts        # 🔄 Integrate LiveKit state
│   └── package.json                 # 🔄 Add @livekit/components-react
│
├── ranker/                    # 🆕 NEW - XGBoost training
│   ├── train.py               # Training pipeline
│   ├── evaluate.py            # Model evaluation
│   └── xgboost/               # 📦 Cloned: xgboost lib (reference)
│
├── tts/
│   ├── elevenlabs/            # ✅ Existing (ElevenLabs integration)
│   └── melotts/               # 📦 Cloned: MeloTTS (fallback)
│
├── livekit/                   # 📦 Cloned: LiveKit server (reference)
├── ui/livekit-react/          # 📦 Cloned: LiveKit React (reference)
├── bus/redis/                 # 📦 Cloned: Redis (already using existing)
├── compositor/ffmpeg/         # 📦 Cloned: FFmpeg (reference)
│
├── config/                    # ✅ Existing
│   ├── livekit/               # 🆕 NEW - LiveKit config (if self-hosting)
│   ├── prometheus/            # ✅ Existing
│   └── grafana/               # ✅ Existing
│
├── shared/                    # ✅ Existing
│   ├── types/                 # 🔄 Add new types (Track, ByteTrack features)
│   └── utils/                 # 🔄 Add shared utilities
│
├── docker-compose.yml         # 🔄 Add compositor service, update volumes
├── INTEGRATION_PLAN.md        # 🆕 THIS DOCUMENT
└── README.md                  # 🔄 Update with new architecture
```

**Legend**:
- ✅ Existing component (no changes)
- 🔄 Existing component (enhancements planned)
- 🆕 NEW component to be created
- 📦 Cloned repository (reference/source code)

---

## Appendix B: Environment Variables

### New/Updated Environment Variables

```bash
# --- LiveKit ---
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
LIVEKIT_ROOM_NAME=ai-obs-demo

# --- Analysis Worker ---
YOLO_MODEL=yolo11n.engine         # TensorRT engine path
VLM_MODEL=llava-v1.5-7b           # LLaVA model ID
VLM_LOAD_4BIT=true                # 4-bit quantization
WHISPER_MODEL=turbo               # Faster-Whisper model
WHISPER_BATCH_SIZE=8              # Batched inference
BYTETRACK_ENABLED=true            # Enable object tracking

# --- Ranking ---
RANKER_TYPE=xgboost               # or "rule-based"
XGBOOST_MODEL_PATH=/models/camera_ranker.xgb

# --- Compositor ---
COMPOSITOR_ENABLED=true
COMPOSITOR_OVERLAY_PATH=/assets/lower-third.png
COMPOSITOR_TRANSITION=dissolve    # or "cut"
COMPOSITOR_TRANSITION_MS=300

# --- TTS ---
TTS_PROVIDER=elevenlabs           # or "melo"
ELEVENLABS_API_KEY=<key>
ELEVENLABS_VOICE_ID=eleven_monica
MELO_FALLBACK_ENABLED=true

# --- Redis ---
REDIS_URL=redis://localhost:6379
REDIS_SCORES_CHANNEL=scores.stream
REDIS_SWITCH_CHANNEL=switch.cmd

# --- Monitoring ---
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
CLICKHOUSE_URL=http://localhost:8123
```

---

## Appendix C: Docker Compose Updates

### Key Changes to `docker-compose.yml`

```yaml
services:
  # --- NEW: Compositor Service ---
  compositor:
    build: ./services/compositor
    ports:
      - "3004:3004"
    environment:
      - LIVEKIT_URL=${LIVEKIT_URL}
      - REDIS_URL=redis://redis:6379
      - COMPOSITOR_ENABLED=true
    volumes:
      - ./services/compositor/assets:/app/assets
    depends_on:
      - redis
      - livekit  # If self-hosting

  # --- UPDATED: Analysis Worker ---
  analysis-worker:
    build: ./workers/analysis-worker
    runtime: nvidia
    environment:
      - YOLO_MODEL=/models/yolo11n.engine
      - VLM_MODEL=llava-v1.5-7b
      - VLM_LOAD_4BIT=true
      - WHISPER_BATCH_SIZE=8
      - BYTETRACK_ENABLED=true
      - RANKER_TYPE=xgboost
    volumes:
      - model-cache:/root/.cache
      - ./models:/models  # TensorRT engines
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  # --- OPTIONAL: Self-hosted LiveKit ---
  livekit:
    image: livekit/livekit-server:latest
    ports:
      - "7880:7880"   # HTTP/WebSocket
      - "7881:7881"   # WebRTC/TCP
      - "50000-60000:50000-60000/udp"  # WebRTC/UDP
    environment:
      - LIVEKIT_KEYS=${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}
    volumes:
      - ./config/livekit:/etc/livekit
    command: --config /etc/livekit/config.yaml
```

---

**End of Integration Plan**

This plan provides a complete roadmap for integrating all cloned repositories into the AI-OBS system. Implementation should follow the phased approach, with continuous testing and monitoring at each stage.
