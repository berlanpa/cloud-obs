# AI-OBS Complete Implementation Plan

## Executive Summary

**Goal**: Connect 5 phones on local WiFi → Stream cameras → AI ranks feeds → Auto-switch to most interesting → Display on web UI

**Current Status**:
- ✅ Architecture designed (85% complete)
- ✅ AI analysis pipeline built (YOLO11, LLaVA, Whisper, ByteTrack)
- ✅ Decision engine complete
- ✅ Web UI complete
- ❌ **LiveKit integration incomplete** (15% critical missing)
- ❌ Phone camera ingestion not implemented
- ❌ Video switching not functional

**Estimated Work**: ~600-800 lines of code across 8 files

---

## Part 1: Current Codebase Deep Analysis

### What EXISTS (Can keep as-is)

#### ✅ Complete & Working
1. **Decision Service** (`services/decision-service/`) - 100% done
   - Switching logic with hysteresis/cooldown
   - Anti-ping-pong detection
   - Configurable thresholds
   - Redis pub/sub integration

2. **TTS Orchestrator** (`services/tts-orchestrator/`) - 95% done
   - Narration generation from context
   - Piper TTS integration working
   - Just needs: Audio publishing to LiveKit (~30 lines)

3. **Web UI** (`web-obs/`) - 100% done
   - Camera preview grid
   - Program monitor
   - Manual/Auto controls
   - Event log
   - LiveKit React SDK integrated

4. **Shared Types** (`shared/types/`) - 100% done
   - TypeScript interfaces for all messages
   - Type safety across services

5. **Infrastructure** - 100% done
   - Docker Compose
   - Redis, Postgres, ClickHouse
   - Prometheus/Grafana configs

#### ⚠️ Partially Complete (Needs work)

1. **Analysis Worker** (`workers/analysis-worker/src/main.py`) - **60% complete**
   ```python
   # Line 69: COMMENTED OUT - Critical!
   # await self.room.connect(config.livekit_url, token)

   # Line 124-133: STUB METHODS
   def _frame_to_numpy(self, frame) -> np.ndarray:
       # Placeholder - implement based on actual frame format
       pass
   ```

   **Issues**:
   - ❌ Token generation missing (line 53-55)
   - ❌ Room connection disabled (line 69)
   - ❌ Frame conversion stubbed (line 124-128)
   - ❌ Audio conversion stubbed (line 130-133)

   **Needed**: ~150 lines to implement LiveKit integration

2. **Program Producer** (`services/program-producer/src/index.ts`) - **40% complete**
   ```typescript
   // Line 107-110: TODO comments
   // In a real implementation, this would:
   // 1. Subscribe to the new camera's track
   // 2. Publish it as the "program" track
   // 3. Optionally apply transitions
   ```

   **Issues**:
   - ❌ Just updates a variable (line 112)
   - ❌ Doesn't actually subscribe to tracks
   - ❌ Doesn't republish program feed
   - ❌ No LiveKit Room participant

   **Needed**: ~200 lines for track management

3. **API Gateway** (`services/api-gateway/src/index.ts`) - **90% complete**
   - Token generation works but needs room configuration
   - WebSocket events working
   - Just needs: Room management endpoints (~50 lines)

#### ❌ Missing Entirely

1. **Compositor Service** - Referenced in docker-compose.yml but **DOES NOT EXIST**
   ```yaml
   # Line 132-150 in docker-compose.yml
   compositor:
     build: context: ./services/compositor  # ← Directory doesn't exist!
   ```

   **Options**:
   - **Option A**: Implement FFmpeg-based compositor (~400 lines)
   - **Option B**: Pure LiveKit track forwarding (~100 lines)
   - **Option C**: Remove entirely and use Program Producer

2. **LiveKit Server** - Not in docker-compose
   - Needs to be added or run separately

3. **Phone Camera Apps** - No client apps provided
   - Need web app or instructions for native apps

---

## Part 2: Phone Camera Ingestion - Deep Research

### Option 1: LiveKit Web App (PWA) ⭐ RECOMMENDED

**How it works**:
```
Phone Browser → Open webapp URL → Request camera → Join LiveKit room → Publish track
```

**Pros**:
- ✅ No app install needed
- ✅ Works on iOS & Android
- ✅ Can run as PWA (add to home screen)
- ✅ ~200 lines of code total
- ✅ Same network or internet

**Cons**:
- ⚠️ Safari requires HTTPS (even on local network)
- ⚠️ Battery drain higher than native

**Implementation**:
```html
<!-- Simple LiveKit camera publisher -->
<!DOCTYPE html>
<html>
<head><title>Camera {N}</title></head>
<body>
  <video id="preview" autoplay muted></video>
  <script src="https://unpkg.com/livekit-client/dist/livekit-client.umd.js"></script>
  <script>
    const camId = new URLSearchParams(location.search).get('id') || 'cam-1';
    const apiUrl = 'http://YOUR_LOCAL_IP:3000';

    async function start() {
      // Get token from API
      const res = await fetch(`${apiUrl}/token`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          identity: camId,
          room: 'main',
          role: 'camera'
        })
      });
      const {token, url} = await res.json();

      // Connect to LiveKit
      const room = new LiveKitClient.Room();
      await room.connect(url, token);

      // Publish camera
      await room.localParticipant.setCameraEnabled(true);
      await room.localParticipant.setMicrophoneEnabled(true);

      // Show preview
      const track = Array.from(room.localParticipant.videoTracks.values())[0].track;
      track.attach(document.getElementById('preview'));
    }

    start();
  </script>
</body>
</html>
```

**URL scheme**:
- Phone 1: `https://YOUR_IP:3000/camera?id=cam-1`
- Phone 2: `https://YOUR_IP:3000/camera?id=cam-2`
- etc.

### Option 2: LiveKit Native Apps

**Use existing apps**:
- **LiveKit Meet** (official example app)
  - iOS: https://github.com/livekit/client-sdk-swift
  - Android: https://github.com/livekit/client-sdk-android

**Pros**:
- ✅ Better performance
- ✅ Lower battery usage
- ✅ More camera controls

**Cons**:
- ❌ Requires app install
- ❌ Needs Xcode/Android Studio to build
- ❌ More complex setup

### Option 3: RTMP Ingest → LiveKit

**Apps**: Larix Broadcaster, Streamlabs Mobile, OBS Camera

**Flow**:
```
Phone (RTMP app) → RTMP Server → FFmpeg → LiveKit (WHIP)
```

**Pros**:
- ✅ Professional streaming apps available
- ✅ Many camera controls

**Cons**:
- ❌ Adds latency (~2-5 seconds)
- ❌ Requires RTMP→LiveKit bridge
- ❌ More complex architecture

**Decision**: **Use Option 1** (Web App) for MVP, can add native apps later.

---

## Part 3: LiveKit Architecture Decision

### Current Issue: Two Approaches Mixed

**Your docker-compose.yml shows**:
1. **Program Producer** - LiveKit track management (incomplete)
2. **Compositor** - FFmpeg video processing (doesn't exist)

**This is conflicting!** Need to choose ONE approach.

### Approach A: Pure LiveKit (Track Forwarding) ⭐ RECOMMENDED

```
Cameras → LiveKit Room → Analysis Worker subscribes → Decision Service
                         ↓                               ↓
                    Frame analysis                  Switch command
                         ↓                               ↓
                    Scores to Redis  ←────────────────────

Program Producer subscribes to all cameras, republishes chosen track as "program"
                         ↓
              Web UI subscribes to "program" track
```

**Pros**:
- ✅ Low latency (~200-400ms)
- ✅ True WebRTC end-to-end
- ✅ Simpler architecture
- ✅ No FFmpeg needed
- ✅ Can add transitions later

**Cons**:
- ⚠️ Hard cuts only (initially)
- ⚠️ No overlays (initially)

**Implementation**:
- Program Producer becomes LiveKit Room participant
- Subscribes to all 5 camera tracks
- On switch command, changes which track it republishes
- ~200 lines of code

### Approach B: FFmpeg Compositor

```
Cameras → LiveKit → Egress to FFmpeg → Composite video → WHIP back to LiveKit
```

**Pros**:
- ✅ Professional transitions (dissolve, wipe)
- ✅ Overlays (lower thirds, graphics)
- ✅ More broadcast-like

**Cons**:
- ❌ Higher latency (~1-2 seconds added)
- ❌ More complex
- ❌ Requires FFmpeg expertise
- ❌ More CPU intensive

**Decision**: **Start with Approach A**, add compositor later as enhancement.

---

## Part 4: Complete Implementation Checklist

### Phase 1: Core LiveKit Integration (CRITICAL - 4-6 hours)

#### 1.1: Add LiveKit Server to Stack
**File**: `docker-compose.yml`
**Action**: Add LiveKit service
```yaml
livekit-server:
  image: livekit/livekit-server:latest
  command: --dev --bind 0.0.0.0
  ports:
    - "7880:7880"   # WebSocket
    - "7881:7881"   # HTTP
    - "7882:7882/udp"  # WebRTC
  environment:
    - LIVEKIT_KEYS=devkey:secret
  volumes:
    - ./config/livekit.yaml:/livekit.yaml
```

**Lines**: ~20

#### 1.2: Implement Token Generation
**File**: `services/api-gateway/src/index.ts` (line 48-77)
**Status**: 90% done, needs room defaults

**Change**:
```typescript
// Current (line 63):
const grants = { room, roomJoin: true, ... };

// Add:
if (!room) room = 'main';  // Default room
token.metadata = JSON.stringify({ cameraId: identity });
```

**Lines**: +5

#### 1.3: Implement Frame Conversion in Analysis Worker
**File**: `workers/analysis-worker/src/main.py`
**Current**: Lines 124-133 are stubs

**Implementation**:
```python
def _frame_to_numpy(self, frame: rtc.VideoFrame) -> np.ndarray:
    """Convert LiveKit VideoFrame to numpy array."""
    from av import VideoFrame as AVVideoFrame

    # Get frame buffer
    buffer = frame.data

    # Convert to PIL Image, then numpy
    from PIL import Image
    import io

    # VideoFrame provides YUV data, need to convert
    width, height = frame.width, frame.height

    # Use PyAV to handle the conversion
    av_frame = AVVideoFrame(width, height, 'yuv420p')
    av_frame.planes[0].update(buffer.planes[0])
    av_frame.planes[1].update(buffer.planes[1])
    av_frame.planes[2].update(buffer.planes[2])

    # Convert to RGB
    rgb_frame = av_frame.to_rgb().to_ndarray()

    return rgb_frame

def _audio_frame_to_numpy(self, frame: rtc.AudioFrame) -> np.ndarray:
    """Convert LiveKit AudioFrame to numpy array."""
    # AudioFrame provides PCM data directly
    return np.frombuffer(frame.data, dtype=np.int16).astype(np.float32) / 32768.0
```

**Lines**: ~30

#### 1.4: Enable LiveKit Connection
**File**: `workers/analysis-worker/src/main.py` (line 49-70)

**Change**:
```python
# Line 53-55: Replace TODO with actual token generation
from livekit import api

async def _get_token(self):
    token = api.AccessToken(config.livekit_api_key, config.livekit_api_secret)
    token.with_identity('analysis-worker')
    token.with_name('Analysis Worker')
    token.add_grant(api.VideoGrants(
        room_join=True,
        room='main',
        can_publish=False,
        can_subscribe=True,
        hidden=True
    ))
    return token.to_jwt()

# Line 69: Uncomment and use token
token = await self._get_token()
await self.room.connect(config.livekit_url, token)
```

**Lines**: ~20

#### 1.5: Implement Program Producer Track Management
**File**: `services/program-producer/src/index.ts`
**Current**: 140 lines, mostly stub
**Needs**: Complete rewrite

**New Implementation**:
```typescript
import { Room, RoomEvent, Track, RemoteTrack, LocalTrackPublication } from 'livekit-client';
import { AccessToken } from 'livekit-server-sdk';

class ProgramProducer {
  private room: Room;
  private cameras: Map<string, RemoteTrack> = new Map();
  private currentCam: string | null = null;

  async connect() {
    // Generate token
    const token = new AccessToken(apiKey, apiSecret, {
      identity: 'program-producer',
    });
    token.addGrant({ roomJoin: true, room: 'main', canPublish: true, canSubscribe: true });
    const jwt = await token.toJwt();

    // Connect
    this.room = new Room();
    await this.room.connect(wsUrl, jwt);

    // Subscribe to all camera tracks
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Video && participant.identity.startsWith('cam-')) {
        this.cameras.set(participant.identity, track as RemoteTrack);
        console.log(`Subscribed to ${participant.identity}`);
      }
    });
  }

  async switchTo(camId: string) {
    const track = this.cameras.get(camId);
    if (!track) {
      console.error(`Camera ${camId} not found`);
      return;
    }

    // Publish this track as "program"
    // Note: LiveKit doesn't support track forwarding directly
    // So we need to create a MediaStreamTrack from the RemoteTrack

    // Alternative: Use MediaStreamTrack.clone() or canvas-based approach
    // For now, just update metadata to tell UI which camera is active

    this.currentCam = camId;

    // Publish data message
    await this.room.localParticipant.publishData(
      JSON.stringify({ type: 'PROGRAM_CHANGE', camera: camId }),
      { reliable: true }
    );
  }
}
```

**Wait**: This reveals a **critical architecture issue!**

### ⚠️ PROBLEM DISCOVERED: LiveKit Track Forwarding Limitation

**Issue**: LiveKit (JavaScript SDK) **cannot directly re-publish a subscribed RemoteTrack**.

**Why**: WebRTC MediaStreamTracks from remote sources cannot be added to local RTCPeerConnection.

**Solutions**:

1. **Canvas-based forwarding** (hack, adds latency)
2. **Server-side track forwarding** (requires LiveKit Egress/Ingress)
3. **Change architecture**: Web UI subscribes to all cameras directly, just highlights the active one

**Best Solution**: **#3 - UI-based switching**

```
Analysis Worker → Scores → Decision Service → "cam-3 is best"
                                                     ↓
                              Redis pub/sub: "active_camera: cam-3"
                                                     ↓
                             Web UI highlights cam-3 preview as "PROGRAM"
                             Web UI can also show cam-3 in big monitor

No track re-publishing needed!
```

This is actually **simpler and better**!

---

## Part 5: REVISED ARCHITECTURE (Simpler & Better)

### New Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 5 Phones (Camera Web App)                                      │
│ http://YOUR_IP:3000/camera?id=cam-1 (to cam-5)                │
└────────────┬────────────────────────────────────────────────────┘
             │ Publish Video/Audio Tracks
             ↓
┌─────────────────────────────────────────────────────────────────┐
│ LiveKit Server (Room: "main")                                   │
│ - Receives 5 video tracks                                       │
│ - Receives 5 audio tracks                                       │
│ - SFU forwards to subscribers                                   │
└──────┬───────────────────┬──────────────────────────────────────┘
       │                   │
       │                   │
┌──────▼─────────┐  ┌──────▼────────────────────────────────────┐
│ Analysis Worker│  │ Web UI (Browser)                          │
│ - Subscribes to│  │ - Subscribes to all 5 cameras             │
│   all 5 tracks │  │ - Shows grid of previews                  │
│ - Samples 10fps│  │ - Listens to Redis "active.camera"       │
│ - Runs YOLO    │  │ - Highlights active camera                │
│ - Runs VLM     │  │ - Shows active in big "Program" monitor   │
│ - Runs Whisper │  └───────────────────────────────────────────┘
│ - Scores       │
└───────┬────────┘
        │ Publishes scores to Redis
        ↓
┌────────────────────────────────────┐
│ Decision Service                   │
│ - Reads scores from Redis          │
│ - Applies switching logic          │
│ - Publishes "active.camera: cam-3" │
└────────────────────────────────────┘
```

**Key Changes**:
1. ❌ Remove "Program Producer" service (not needed!)
2. ❌ Remove "Compositor" service (not needed for MVP!)
3. ✅ Web UI handles the "switching" visually
4. ✅ Simpler, lower latency, easier to implement

### Program Producer Replacement

**File**: `services/program-producer/src/index.ts`
**New Purpose**: Just broadcast active camera via Redis (already does this!)

**Current code (line 115-124) is actually PERFECT**:
```typescript
await redisPublisher.publish(
  'program.changed',
  JSON.stringify({ camera: toCam })
);
```

**No changes needed!** The service already does what we need.

---

## Part 6: Final Implementation Plan

### Files to Create (3 new files)

#### 1. Phone Camera Web App
**File**: `web-obs/public/camera.html` (NEW)
**Lines**: ~150
**Purpose**: Smartphone camera publisher

#### 2. LiveKit Config
**File**: `config/livekit.yaml` (NEW)
**Lines**: ~30
**Purpose**: LiveKit server configuration

#### 3. Camera App Instructions
**File**: `PHONE_SETUP.md` (NEW)
**Lines**: ~100
**Purpose**: User guide for connecting phones

### Files to Modify (5 files)

#### 1. Analysis Worker - LiveKit Integration
**File**: `workers/analysis-worker/src/main.py`
**Lines to add/modify**: ~100
**Changes**:
- Implement `_get_token()` method
- Implement `_frame_to_numpy()` method
- Implement `_audio_frame_to_numpy()` method
- Enable `connect_livekit()` call
- Add error handling

#### 2. Docker Compose - Add LiveKit
**File**: `docker-compose.yml`
**Lines to add**: ~20
**Changes**:
- Add `livekit-server` service
- Update environment variables

#### 3. Web UI - Add Active Camera Highlighting
**File**: `web-obs/src/components/CameraPreview.tsx`
**Lines to modify**: ~20
**Changes**:
- Listen to `program.changed` events
- Add visual indicator for active camera
- Enlarge active camera in grid

#### 4. Web UI - Program Monitor Auto-Switch
**File**: `web-obs/src/components/ProgramMonitor.tsx`
**Lines to modify**: ~30
**Changes**:
- Subscribe to active camera from Redis/WebSocket
- Auto-switch displayed feed

#### 5. API Gateway - Add Camera App Endpoint
**File**: `services/api-gateway/src/index.ts`
**Lines to add**: ~40
**Changes**:
- Serve `camera.html` at `/camera`
- Add CORS for local network access

### Files to Delete (1 file)

**None!** We keep everything, just don't use compositor yet.

---

## Part 7: Step-by-Step Implementation Order

### Week 1, Day 1-2: Core LiveKit (4-6 hours)

**Priority 1**: Get video streaming working

1. ✅ Create `config/livekit.yaml`
2. ✅ Add LiveKit to `docker-compose.yml`
3. ✅ Create phone camera web app (`camera.html`)
4. ✅ Test: Phone → LiveKit → Can see track in LiveKit dashboard

### Week 1, Day 3-4: Analysis Integration (6-8 hours)

**Priority 2**: Process video frames

5. ✅ Implement frame conversion in analysis worker
6. ✅ Enable LiveKit connection
7. ✅ Test: Logs show "Subscribed to cam-1" and frame analysis

### Week 1, Day 5: Web UI Integration (4-6 hours)

**Priority 3**: Display feeds

8. ✅ Update Web UI to subscribe to all cameras
9. ✅ Add active camera highlighting
10. ✅ Test: See all 5 phones in web UI grid

### Week 2, Day 1: Decision Flow (2-3 hours)

**Priority 4**: Auto-switching

11. ✅ Verify decision service receives scores
12. ✅ Verify switch commands published
13. ✅ Test: Active camera changes based on scores

### Week 2, Day 2: Polish & Testing (4-6 hours)

14. ✅ Add error handling
15. ✅ Add reconnection logic
16. ✅ Performance tuning
17. ✅ Documentation

---

## Part 8: ElevenLabs Future Integration

**Current**: Piper TTS generates narration, but doesn't publish audio

**To add ElevenLabs later** (30 minutes of work):

### Option A: Replace Piper
1. Change `services/tts-orchestrator/src/narrator.ts` back to ElevenLabs class
2. Add `ELEVENLABS_API_KEY` to `.env`
3. Done!

### Option B: Add as Alternative
1. Add ElevenLabs class alongside Piper
2. Add config option: `TTS_PROVIDER=piper|elevenlabs`
3. Factory pattern selects provider

**Audio Publishing** (needed for either):

**File**: `services/tts-orchestrator/src/index.ts` (line 124)
**Add**:
```typescript
// After synthesizing audio
if (audio) {
  // Publish to LiveKit as audio track
  const audioTrack = new LocalAudioTrack(audio, {
    source: Track.Source.Unknown,
  });

  await room.localParticipant.publishTrack(audioTrack, {
    name: 'commentary',
  });
}
```

**Lines**: ~15

---

## Part 9: Testing Checklist

### Local Network Setup
- [ ] Computer running AI-OBS on `192.168.1.X`
- [ ] 5 phones on same WiFi network
- [ ] Phone can ping computer IP
- [ ] HTTPS certificate for local IP (for iOS Safari)

### System Startup
- [ ] `docker-compose up -d` starts all services
- [ ] LiveKit server accessible: `http://YOUR_IP:7880`
- [ ] Web UI loads: `http://YOUR_IP:3100`
- [ ] Camera app loads: `http://YOUR_IP:3000/camera?id=cam-1`

### Phone Connection
- [ ] Phone 1 opens `camera?id=cam-1`, sees preview
- [ ] Phone 2 opens `camera?id=cam-2`, sees preview
- [ ] Repeat for phones 3-5
- [ ] All 5 cameras appear in web UI grid

### Video Processing
- [ ] Analysis worker logs show "Subscribed to cam-X"
- [ ] Scores published to Redis: `redis-cli SUBSCRIBE scores.stream`
- [ ] Decision service logs show switching decisions
- [ ] Web UI highlights active camera

### Auto-Switching
- [ ] Wave hand in front of Phone 1 → becomes active
- [ ] Talk loudly near Phone 2 → becomes active
- [ ] Walk into frame of Phone 3 → becomes active

---

## Part 10: Code Metrics

### Total Work Required

| Component | Files | Lines | Time |
|-----------|-------|-------|------|
| LiveKit config | 2 | 50 | 1h |
| Phone camera app | 1 | 150 | 2h |
| Analysis worker LiveKit | 1 | 150 | 3h |
| Web UI updates | 3 | 100 | 3h |
| API Gateway updates | 1 | 50 | 1h |
| Documentation | 2 | 200 | 2h |
| Testing & debugging | - | - | 8h |
| **TOTAL** | **10** | **700** | **20h** |

**Realistic Timeline**: 3-4 days of focused work

---

## Part 11: Risk Assessment & Mitigation

### High Risk

**Risk 1**: iOS Safari HTTPS requirement
- **Impact**: Camera won't work on iPhones without HTTPS
- **Mitigation**:
  - Use mkcert to generate local SSL cert
  - Or use ngrok tunnel for testing
  - Or use Android phones only initially

**Risk 2**: LiveKit frame conversion performance
- **Impact**: Frame processing too slow, high CPU
- **Mitigation**:
  - Sample at lower FPS (5fps instead of 10fps)
  - Use smaller resolution (360p instead of 720p)
  - GPU acceleration for conversion

**Risk 3**: Network bandwidth
- **Impact**: 5x 1080p streams = ~25 Mbps
- **Mitigation**:
  - Use 720p or 480p
  - Enable LiveKit simulcast
  - Analysis worker subscribes to lowest quality layer

### Medium Risk

**Risk 4**: Phone battery drain
- **Impact**: Phones die after 1-2 hours
- **Mitigation**:
  - Plug phones into power
  - Reduce bitrate
  - Use native apps (more efficient)

**Risk 5**: Switching too fast/jittery
- **Impact**: Annoying viewing experience
- **Mitigation**:
  - Tune `MIN_HOLD_SEC` higher (3-4 seconds)
  - Increase `DELTA_S_THRESHOLD`
  - Add smoothing to scores

### Low Risk

**Risk 6**: Model download time on first run
- **Impact**: 10-15 minute wait
- **Mitigation**: Document this clearly, provide progress bars

---

## Part 12: Performance Targets

### Latency Budget

| Stage | Target | Acceptable |
|-------|--------|------------|
| Phone → LiveKit | < 200ms | < 500ms |
| LiveKit → Analysis | < 100ms | < 200ms |
| Frame analysis | < 150ms | < 300ms |
| Decision → UI update | < 100ms | < 200ms |
| **TOTAL** | **< 550ms** | **< 1200ms** |

### Resource Usage

| Component | CPU | RAM | GPU |
|-----------|-----|-----|-----|
| LiveKit | 10-20% | 500MB | - |
| Analysis Worker | 50-80% | 4GB | 60% |
| Decision Service | 5% | 200MB | - |
| Web UI (browser) | 10% | 500MB | - |
| **TOTAL** | **~100%** | **5GB** | **60%** |

**Minimum Hardware**:
- CPU: 6 cores
- RAM: 8GB
- GPU: NVIDIA with 6GB VRAM
- Network: 1Gbps Ethernet or WiFi 6

---

## Part 13: Alternative Architectures (For Future)

### Architecture B: Server-Side Compositor

**When to use**: Production deployment, professional output

```
Cameras → LiveKit → Egress → FFmpeg Compositor → WHIP → LiveKit
                                                             ↓
                                                     "program" track
```

**Benefits**:
- Professional transitions (dissolve, wipe)
- Overlays (lower thirds, logos)
- Single output stream
- Can stream to YouTube/Twitch

**Cost**:
- +500-800ms latency
- +40% CPU usage
- ~400 lines of FFmpeg code

**Implementation**: Create `services/compositor/` with FFmpeg filters

### Architecture C: Native Mobile Apps

**When to use**: Better performance needed

**Benefits**:
- Lower battery usage
- Better camera controls
- Background operation
- Push notifications

**Cost**:
- Xcode + Android Studio setup
- ~1000 lines per platform
- App store approval (for distribution)

---

## Conclusion & Next Steps

### Current State:
**85% of hard work is DONE!**
- AI pipeline ✅
- Decision logic ✅
- UI ✅
- Infrastructure ✅

### Missing:
**15% of integration glue**
- LiveKit frame conversion (~150 lines)
- Phone camera app (~150 lines)
- LiveKit server config (~50 lines)
- Web UI tweaks (~100 lines)
- Documentation (~200 lines)

### Total Work:
**~650 lines of code, 20 hours**

### Recommendation:
1. **Implement Phase 1** (LiveKit core) first - 6 hours
2. **Test with 2 phones** before scaling to 5
3. **Use simplified architecture** (UI-based switching)
4. **Add compositor later** as enhancement

### What I Should Do Next:
**Option 1**: Implement all missing pieces (~650 lines)
**Option 2**: Implement in phases, starting with LiveKit core
**Option 3**: Create just the phone camera web app first to test

**Your call!** Which approach do you want me to take?
