# AI-OBS Phased Implementation Plan

## Current Codebase Analysis (As of Now)

### ✅ What EXISTS and WORKS
1. **Enhanced AI Models** (workers/analysis-worker/src/models/)
   - `yolo_detector_v11.py` - YOLO11 implementation
   - `llava_vlm.py` - LLaVA VLM instead of Moondream
   - `whisper_asr_enhanced.py` - Batched Whisper
   - `byte_tracker_wrapper.py` - ByteTrack integration
   - `main_enhanced.py` - Orchestrator with all models
   - `ranker_enhanced.py` - Enhanced ranking

2. **Compositor Service** (services/compositor/)
   - Basic structure exists
   - Redis subscription working
   - FFmpeg integration STUBBED (TODO lines 85-98)

3. **All Backend Services**
   - Decision service ✅
   - TTS orchestrator ✅
   - Program producer ✅
   - API gateway ✅
   - Web UI ✅

### ❌ What's MISSING (Critical Gaps)

1. **LiveKit Server** - Not in docker-compose
2. **LiveKit Integration in Analysis Worker** - Connection disabled (main.py line 69)
3. **Frame/Audio Conversion** - Stubbed (main.py lines 124-133)
4. **Phone Camera Web App** - Doesn't exist
5. **LiveKit Config File** - config/livekit/ is empty
6. **Web UI Multi-Camera Display** - Needs enhancement

---

## PHASE 0: Pre-Flight Checklist (15 minutes)

**Purpose**: Verify system is ready for implementation

### 0.1: Environment Setup
- [ ] Verify Docker & Docker Compose installed
- [ ] Verify NVIDIA GPU accessible: `nvidia-smi`
- [ ] Verify ports available: 3000-3100, 5000, 6379, 7880-7882, 9090
- [ ] Copy `.env.example` to `.env`

### 0.2: Update .env for Enhanced Models
**File**: `.env`
**Changes**:
```bash
# Change these lines to match docker-compose.yml:
YOLO_MODEL=yolo11n  # was yolov8n
VLM_MODEL=liuhaotian/llava-v1.5-7b  # was moondream
WHISPER_MODEL=turbo  # was base.en

# Add new vars:
YOLO_USE_TENSORRT=false  # true after TensorRT engine built
BYTETRACK_ENABLED=true
WHISPER_USE_BATCHED=true
```

### 0.3: Create Essential Directories
```bash
mkdir -p config/livekit
mkdir -p web-obs/public
mkdir -p services/compositor/assets
mkdir -p models  # For TensorRT engines
```

**Success Criteria**: All directories created, .env updated

---

## PHASE 1: LiveKit Server & Basic Connectivity (2 hours)

**Goal**: Get LiveKit running and accessible

### 1.1: Add LiveKit Server to Docker Compose
**File**: `docker-compose.yml`
**Location**: After line 36 (after ClickHouse service)
**Add**:
```yaml
  # LiveKit Server (WebRTC SFU)
  livekit-server:
    image: livekit/livekit-server:v1.5.2
    command: --config /etc/livekit.yaml --bind 0.0.0.0
    ports:
      - "7880:7880"   # HTTP/WebSocket
      - "7881:7881"   # TURN/STUN
      - "7882:7882/udp"  # WebRTC media
      - "7883:7883/udp"  # WebRTC media (range)
    environment:
      - LIVEKIT_KEYS=${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET}
    volumes:
      - ./config/livekit/livekit.yaml:/etc/livekit.yaml
    networks:
      - default
```

**Estimated**: 20 lines

### 1.2: Create LiveKit Configuration
**File**: `config/livekit/livekit.yaml` (NEW)
**Content**:
```yaml
port: 7880
bind_addresses:
  - "0.0.0.0"

rtc:
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: false  # Local network mode
  ice_servers:
    - urls:
        - stun:stun.l.google.com:19302

keys:
  devkey: secret  # Matches .env defaults

room:
  auto_create: true
  empty_timeout: 300  # 5 minutes
  max_participants: 20  # 5 cameras + analysis worker + web clients

logging:
  level: info
  pion_level: warn
```

**Estimated**: 30 lines

### 1.3: Test LiveKit Server
**Commands**:
```bash
# Start just LiveKit
docker-compose up -d livekit-server

# Check logs
docker-compose logs -f livekit-server

# Verify accessible
curl http://localhost:7880
```

**Success Criteria**:
- ✅ LiveKit container running
- ✅ Logs show "Starting LiveKit server"
- ✅ Port 7880 accessible
- ✅ No errors in logs

---

## PHASE 2: Phone Camera Web App (3 hours)

**Goal**: Create web app for phones to stream cameras

### 2.1: Create Camera Publisher App
**File**: `web-obs/public/camera.html` (NEW)
**Content**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>AI-OBS Camera</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow: hidden;
    }
    #container {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #preview {
      flex: 1;
      width: 100%;
      object-fit: cover;
      background: #1a1a1a;
    }
    #controls {
      padding: 20px;
      background: rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    #status {
      font-size: 14px;
      color: #888;
      text-align: center;
    }
    .status-connecting { color: #ffa500; }
    .status-connected { color: #00ff00; }
    .status-error { color: #ff0000; }
    #cameraId {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      color: #fff;
    }
    button {
      padding: 15px;
      font-size: 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
    }
    #connectBtn {
      background: #00ff00;
      color: #000;
    }
    #disconnectBtn {
      background: #ff0000;
      color: #fff;
      display: none;
    }
    .connected #connectBtn { display: none; }
    .connected #disconnectBtn { display: block; }
  </style>
</head>
<body>
  <div id="container">
    <video id="preview" autoplay playsinline muted></video>
    <div id="controls">
      <div id="cameraId"></div>
      <div id="status" class="status-connecting">Initializing...</div>
      <button id="connectBtn">Start Camera</button>
      <button id="disconnectBtn">Stop Camera</button>
    </div>
  </div>

  <script src="https://unpkg.com/livekit-client@1.15.13/dist/livekit-client.umd.min.js"></script>
  <script>
    // Configuration
    const urlParams = new URLSearchParams(window.location.search);
    const cameraId = urlParams.get('id') || 'cam-' + Math.floor(Math.random() * 5 + 1);
    const apiUrl = window.location.origin;
    const roomName = 'main';

    // DOM elements
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');
    const cameraIdEl = document.getElementById('cameraId');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const container = document.getElementById('container');

    // State
    let room = null;
    let localVideoTrack = null;
    let localAudioTrack = null;

    // Update UI
    cameraIdEl.textContent = cameraId.toUpperCase();

    function updateStatus(message, statusClass) {
      status.textContent = message;
      status.className = statusClass;
    }

    async function getToken() {
      updateStatus('Getting access token...', 'status-connecting');

      const response = await fetch(`${apiUrl}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identity: cameraId,
          room: roomName,
          role: 'camera'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to get token');
      }

      return data.data;
    }

    async function connectCamera() {
      try {
        // Get token
        const { token, url } = await getToken();
        updateStatus('Connecting to LiveKit...', 'status-connecting');

        // Create room
        room = new LivekitClient.Room({
          adaptiveStream: true,
          dynacast: true,
          videoCaptureDefaults: {
            resolution: LivekitClient.VideoPresets.h720.resolution,
            facingMode: 'environment' // Back camera by default
          }
        });

        // Setup event handlers
        room.on(LivekitClient.RoomEvent.Connected, () => {
          updateStatus(`Connected as ${cameraId}`, 'status-connected');
          container.classList.add('connected');
        });

        room.on(LivekitClient.RoomEvent.Disconnected, () => {
          updateStatus('Disconnected', 'status-error');
          container.classList.remove('connected');
        });

        room.on(LivekitClient.RoomEvent.Reconnecting, () => {
          updateStatus('Reconnecting...', 'status-connecting');
        });

        room.on(LivekitClient.RoomEvent.Reconnected, () => {
          updateStatus(`Connected as ${cameraId}`, 'status-connected');
        });

        // Connect to room
        await room.connect(url, token);

        // Enable camera
        updateStatus('Starting camera...', 'status-connecting');
        await room.localParticipant.setCameraEnabled(true);

        // Enable microphone
        await room.localParticipant.setMicrophoneEnabled(true);

        // Get local video track and attach to preview
        const videoPublication = Array.from(room.localParticipant.videoTracks.values())[0];
        if (videoPublication && videoPublication.track) {
          localVideoTrack = videoPublication.track;
          localVideoTrack.attach(preview);
        }

        updateStatus(`Streaming as ${cameraId}`, 'status-connected');

      } catch (error) {
        console.error('Connection error:', error);
        updateStatus(`Error: ${error.message}`, 'status-error');
      }
    }

    async function disconnectCamera() {
      if (room) {
        await room.disconnect();
        room = null;
      }
      if (localVideoTrack) {
        localVideoTrack.detach();
        localVideoTrack = null;
      }
      updateStatus('Disconnected', 'status-error');
      container.classList.remove('connected');
    }

    // Button handlers
    connectBtn.addEventListener('click', connectCamera);
    disconnectBtn.addEventListener('click', disconnectCamera);

    // Prevent screen sleep
    if ('wakeLock' in navigator) {
      let wakeLock = null;
      const requestWakeLock = async () => {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
          console.warn('Wake lock error:', err);
        }
      };
      document.addEventListener('visibilitychange', () => {
        if (wakeLock !== null && document.visibilityState === 'visible') {
          requestWakeLock();
        }
      });
      requestWakeLock();
    }

    // Auto-connect on page load
    updateStatus('Ready - Tap to start', 'status-connecting');
  </script>
</body>
</html>
```

**Estimated**: 250 lines

### 2.2: Serve Camera App from API Gateway
**File**: `services/api-gateway/src/index.ts`
**Location**: After line 105 (after /config endpoint)
**Add**:
```typescript
// Serve camera app for phones
fastify.get('/camera', async (request, reply) => {
  return reply.sendFile('camera.html', path.join(__dirname, '../../web-obs/public'));
});
```

**Dependencies**: Add `@fastify/static` to package.json
**File**: `services/api-gateway/package.json`
**Add to dependencies**:
```json
"@fastify/static": "^6.12.0"
```

**File**: `services/api-gateway/src/index.ts` (top of file)
**Add import and registration**:
```typescript
import fastifyStatic from '@fastify/static';
import path from 'path';

// After cors registration (around line 25):
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../web-obs/public'),
  prefix: '/static/'
});
```

**Estimated**: 20 lines

### 2.3: Test Phone Camera App
**Steps**:
1. Start services: `docker-compose up -d api-gateway`
2. Get local IP: `ifconfig | grep "inet " | grep -v 127.0.0.1`
3. Open on phone: `http://YOUR_IP:3000/camera?id=cam-1`
4. Grant camera permissions
5. Tap "Start Camera"

**Success Criteria**:
- ✅ Camera app loads on phone
- ✅ Preview shows camera feed
- ✅ Status shows "Connected as CAM-1"
- ✅ LiveKit logs show participant "cam-1" joined

---

## PHASE 3: Analysis Worker LiveKit Integration (4 hours)

**Goal**: Connect analysis worker to LiveKit and process frames

### 3.1: Implement Token Generation
**File**: `workers/analysis-worker/src/main.py`
**Location**: After line 47 (before connect_livekit method)
**Add**:
```python
async def _generate_token(self) -> str:
    """Generate LiveKit access token for analysis worker."""
    from livekit import api

    token = api.AccessToken(
        config.livekit_api_key,
        config.livekit_api_secret
    )
    token.with_identity('analysis-worker')
    token.with_name('AI Analysis Worker')
    token.with_metadata(json.dumps({'role': 'analyzer'}))

    grants = api.VideoGrants(
        room_join=True,
        room='main',
        can_publish=False,  # We only subscribe
        can_subscribe=True,
        can_publish_data=True,  # For metadata
        hidden=True  # Don't show in participant list
    )
    token.add_grant(grants)

    return token.to_jwt()
```

**Estimated**: 25 lines

### 3.2: Implement Frame Conversion (PyAV-based)
**File**: `workers/analysis-worker/src/main.py`
**Location**: Replace lines 124-133 (the stub methods)
**Replace with**:
```python
def _frame_to_numpy(self, frame: rtc.VideoFrame) -> np.ndarray:
    """
    Convert LiveKit VideoFrame to numpy array.
    Uses PyAV for efficient YUV->RGB conversion.
    """
    import av

    # Create PyAV VideoFrame from buffer
    av_frame = av.VideoFrame(frame.width, frame.height, 'yuv420p')

    # Copy plane data
    for i, plane in enumerate(frame.data.planes):
        av_frame.planes[i].update(bytes(plane))

    # Convert to RGB and get numpy array
    rgb_frame = av_frame.to_rgb()
    img = rgb_frame.to_ndarray()

    return img

def _audio_frame_to_numpy(self, frame: rtc.AudioFrame) -> np.ndarray:
    """
    Convert LiveKit AudioFrame to numpy array.
    Returns float32 array normalized to [-1.0, 1.0]
    """
    # AudioFrame.data is already PCM int16
    samples = np.frombuffer(
        bytes(frame.data),
        dtype=np.int16
    )

    # Convert to float32 and normalize
    audio = samples.astype(np.float32) / 32768.0

    return audio
```

**Estimated**: 35 lines

### 3.3: Enable LiveKit Connection
**File**: `workers/analysis-worker/src/main.py`
**Location**: Line 69 (the commented-out connection)
**Replace**:
```python
# Line 53-55: Remove TODO, use our token method
token = await self._generate_token()

# Line 69: Uncomment and use token
await self.room.connect(config.livekit_url, token)
logger.info(f"✓ Connected to LiveKit room: main")
```

**Estimated**: 5 lines (mostly uncommenting)

### 3.4: Add Error Handling and Reconnection
**File**: `workers/analysis-worker/src/main.py`
**Location**: In connect_livekit method, after room setup
**Add**:
```python
@self.room.on("disconnected")
def on_disconnected():
    logger.warning("Disconnected from LiveKit, attempting reconnect...")
    asyncio.create_task(self._reconnect_livekit())

@self.room.on("connection_quality_changed")
def on_quality_changed(quality, participant):
    if participant.identity.startswith('cam-'):
        logger.debug(f"{participant.identity} quality: {quality}")

async def _reconnect_livekit(self):
    """Attempt to reconnect to LiveKit with exponential backoff."""
    max_attempts = 5
    attempt = 0
    while attempt < max_attempts:
        try:
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
            await self.connect_livekit()
            logger.info("✓ Reconnected to LiveKit")
            return
        except Exception as e:
            attempt += 1
            logger.error(f"Reconnect attempt {attempt}/{max_attempts} failed: {e}")

    logger.critical("Failed to reconnect to LiveKit after max attempts")
```

**Estimated**: 30 lines

### 3.5: Test Analysis Worker Connection
**Commands**:
```bash
# Ensure LiveKit is running
docker-compose up -d livekit-server

# Start analysis worker (with logs)
docker-compose up analysis-worker

# Watch logs for:
# - "Connected to Redis"
# - "✓ Connected to LiveKit room: main"
# - "Subscribed to track: ... from cam-1" (when phone connects)
```

**Success Criteria**:
- ✅ Analysis worker starts without errors
- ✅ Connects to LiveKit successfully
- ✅ Logs show "Subscribed to track" when camera joins
- ✅ Frame processing logs appear

---

## PHASE 4: Web UI Multi-Camera Display (3 hours)

**Goal**: Show all 5 cameras in web UI and highlight active

### 4.1: Update Web UI to Subscribe to All Cameras
**File**: `web-obs/src/components/CameraGrid.tsx`
**Location**: Replace current implementation (lines 8-30)
**Replace with**:
```typescript
export default function CameraGrid() {
  const room = useRoomContext();
  const { scores, currentProgram } = useAppStore();
  const [cameras, setCameras] = useState<Map<string, RemoteParticipant>>(new Map());

  // Track all camera participants
  useEffect(() => {
    if (!room) return;

    const handleParticipantConnected = (participant: RemoteParticipant) => {
      if (participant.identity.startsWith('cam-')) {
        setCameras(prev => new Map(prev).set(participant.identity, participant));
      }
    };

    const handleParticipantDisconnected = (participant: RemoteParticipant) => {
      setCameras(prev => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    };

    // Initial participants
    room.remoteParticipants.forEach(handleParticipantConnected);

    // Subscribe to events
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  // Convert to array for rendering
  const cameraList = Array.from(cameras.entries()).map(([id, participant]) => {
    const score = scores.get(id);
    return {
      id,
      participant,
      score: score?.score || 0,
      isProgram: id === currentProgram,
    };
  });

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="font-semibold mb-4">Camera Previews ({cameraList.length}/5)</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cameraList.map((cam) => (
          <CameraPreview key={cam.id} camera={cam} />
        ))}
        {cameraList.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-8">
            No cameras connected. Open camera app on phones.
          </div>
        )}
      </div>
    </div>
  );
}
```

**Estimated**: 60 lines

### 4.2: Update CameraPreview to Use LiveKit Tracks
**File**: `web-obs/src/components/CameraPreview.tsx`
**Location**: Replace useEffect (lines 15-31)
**Replace with**:
```typescript
useEffect(() => {
  if (!videoRef.current || !camera.participant) return;

  // Get video track publication
  const videoPublication = camera.participant.getTrack(Track.Source.Camera);

  if (videoPublication?.track) {
    const videoTrack = videoPublication.track as RemoteVideoTrack;

    // Attach track to video element
    videoTrack.attach(videoRef.current);

    return () => {
      videoTrack.detach(videoRef.current);
    };
  }
}, [camera.participant]);
```

**Estimated**: 20 lines

### 4.3: Update Program Monitor for Active Camera
**File**: `web-obs/src/components/ProgramMonitor.tsx`
**Location**: Replace entire component
**Replace with**:
```typescript
export default function ProgramMonitor() {
  const { currentProgram } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const room = useRoomContext();
  const [activeParticipant, setActiveParticipant] = useState<RemoteParticipant | null>(null);

  // Find active camera participant
  useEffect(() => {
    if (!room || !currentProgram) return;

    const participant = room.remoteParticipants.get(currentProgram);
    setActiveParticipant(participant || null);
  }, [room, currentProgram]);

  // Attach video track
  useEffect(() => {
    if (!videoRef.current || !activeParticipant) return;

    const videoPublication = activeParticipant.getTrack(Track.Source.Camera);
    if (videoPublication?.track) {
      const videoTrack = videoPublication.track as RemoteVideoTrack;
      videoTrack.attach(videoRef.current);

      return () => {
        videoTrack.detach(videoRef.current);
      };
    }
  }, [activeParticipant]);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Program</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">LIVE</span>
          </div>
        </div>
      </div>
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain"
        />
        {currentProgram ? (
          <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-1 rounded text-sm">
            {currentProgram.toUpperCase()}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Waiting for camera selection...
          </div>
        )}
      </div>
    </div>
  );
}
```

**Estimated**: 60 lines

### 4.4: Test Web UI
**Steps**:
1. Connect 2 phones to camera app
2. Open Web UI: `http://localhost:3100`
3. Verify both cameras appear in grid
4. Verify program monitor shows one camera
5. Wave hand in front of Phone 1
6. Verify UI highlights changes when decision service switches

**Success Criteria**:
- ✅ Camera grid shows all connected cameras
- ✅ Camera previews show live video
- ✅ Program monitor shows active camera feed
- ✅ Active camera highlight changes when AI switches

---

## PHASE 5: End-to-End Integration & Testing (4 hours)

**Goal**: Complete data flow from cameras → AI → decision → UI

### 5.1: Start All Services
**File**: Create `start-all.sh` (NEW)
```bash
#!/bin/bash

echo "Starting AI-OBS System..."

# Pull latest images
docker-compose pull

# Build local services
docker-compose build

# Start infrastructure first
echo "Starting infrastructure (Redis, Postgres, ClickHouse, LiveKit)..."
docker-compose up -d redis postgres clickhouse livekit-server

# Wait for infrastructure
echo "Waiting for services to be ready..."
sleep 10

# Start AI services
echo "Starting AI analysis worker..."
docker-compose up -d analysis-worker

sleep 5

# Start decision pipeline
echo "Starting decision pipeline..."
docker-compose up -d decision-service tts-orchestrator piper-tts

sleep 3

# Start frontend
echo "Starting API gateway and Web UI..."
docker-compose up -d api-gateway web-obs

echo ""
echo "✓ All services started!"
echo ""
echo "Access points:"
echo "  - Web UI:        http://localhost:3100"
echo "  - Camera App:    http://YOUR_IP:3000/camera?id=cam-1"
echo "  - API Gateway:   http://localhost:3000"
echo "  - LiveKit:       http://localhost:7880"
echo ""
echo "Connect cameras by opening camera app on phones:"
echo "  Phone 1: http://YOUR_IP:3000/camera?id=cam-1"
echo "  Phone 2: http://YOUR_IP:3000/camera?id=cam-2"
echo "  Phone 3: http://YOUR_IP:3000/camera?id=cam-3"
echo "  Phone 4: http://YOUR_IP:3000/camera?id=cam-4"
echo "  Phone 5: http://YOUR_IP:3000/camera?id=cam-5"
echo ""
echo "View logs: docker-compose logs -f"
```

Make executable: `chmod +x start-all.sh`

**Estimated**: 50 lines

### 5.2: Create System Health Check Script
**File**: Create `check-health.sh` (NEW)
```bash
#!/bin/bash

echo "AI-OBS System Health Check"
echo "=========================="
echo ""

check_service() {
  local name=$1
  local url=$2

  if curl -sf "$url" > /dev/null 2>&1; then
    echo "✓ $name"
  else
    echo "✗ $name (not responding)"
  fi
}

# Check services
check_service "LiveKit Server    " "http://localhost:7880"
check_service "API Gateway       " "http://localhost:3000/health"
check_service "Decision Service  " "http://localhost:3001/health"
check_service "TTS Orchestrator  " "http://localhost:3002/health"
check_service "Piper TTS         " "http://localhost:5000/health"
check_service "Web UI            " "http://localhost:3100"
check_service "Prometheus        " "http://localhost:9090/-/healthy"

echo ""
echo "Docker Containers:"
docker-compose ps --format "table {{.Service}}\t{{.Status}}"

echo ""
echo "LiveKit Participants:"
# This requires livekit-cli, skip if not installed
if command -v livekit-cli &> /dev/null; then
  livekit-cli list-participants --url ws://localhost:7880 \
    --api-key devkey --api-secret secret --room main 2>/dev/null || echo "No room active yet"
else
  echo "(Install livekit-cli to see participants)"
fi
```

Make executable: `chmod +x check-health.sh`

**Estimated**: 40 lines

### 5.3: Full System Test
**Test Scenario**: 5 phones, all features

1. **Start System**
   ```bash
   ./start-all.sh
   ./check-health.sh
   ```

2. **Connect Cameras**
   - Phone 1-5: Open camera app, start streaming
   - Verify all appear in Web UI grid

3. **Test AI Analysis**
   - Check logs: `docker-compose logs -f analysis-worker`
   - Should see: "Subscribed to cam-X" for each camera
   - Should see: Frame analysis scores

4. **Test Auto-Switching**
   - Wave hand in front of Phone 1
   - Watch Web UI - should highlight cam-1 as program
   - Talk loudly near Phone 2
   - Watch Web UI - might switch to cam-2
   - Walk into Phone 3 frame
   - Watch for potential switch

5. **Test Manual Override**
   - Click "Manual" in Web UI
   - Click on camera preview
   - Verify program switches immediately
   - Click "Auto" to resume AI control

6. **Monitor System**
   - Open Grafana: `http://localhost:3005`
   - Check metrics dashboards
   - View switch history

**Success Criteria**:
- ✅ All 5 phones streaming
- ✅ All cameras visible in Web UI
- ✅ AI analysis running (logs show scores)
- ✅ Auto-switching working (program changes)
- ✅ Manual override working
- ✅ No errors in any service logs
- ✅ Latency < 2 seconds (camera → decision → UI update)

### 5.4: Performance Tuning
**If experiencing issues**:

**High CPU/GPU Usage**:
```bash
# Edit .env
FRAME_SAMPLE_RATE=5  # Lower from 10
VLM_INTERVAL_MS=1500  # Less frequent VLM calls
YOLO_MODEL=yolo11n  # Smallest model
```

**High Network Usage**:
```bash
# Cameras send lower quality to analysis worker
# Edit camera.html, line 125:
resolution: LivekitClient.VideoPresets.h540.resolution,  # Lower from h720
```

**Slow Switching**:
```bash
# Edit .env
MIN_HOLD_SEC=1.5  # Faster switches (but may be jittery)
DELTA_S_THRESHOLD=0.10  # More sensitive
```

---

## PHASE 6: Optional Enhancements (Future)

These are NOT required for MVP but can be added later:

### 6.1: FFmpeg Compositor (Professional Transitions)
- Implement TODO in `services/compositor/src/index.ts`
- Add dissolve/wipe transitions
- Add lower-third overlays
- ~400 lines of FFmpeg filter code

### 6.2: TTS Audio Publishing
- Publish Piper TTS audio to LiveKit
- Add as "commentary" track
- ~30 lines in `services/tts-orchestrator/src/index.ts`

### 6.3: XGBoost ML Ranker
- Train model on labeled switching data
- Replace rule-based ranker
- Already configured in docker-compose!

### 6.4: Native Mobile Apps
- Build iOS app (Swift + LiveKit SDK)
- Build Android app (Kotlin + LiveKit SDK)
- Better battery life and performance

### 6.5: Recording & Replay
- Record program feed
- Save switching decisions
- Replay with different algorithms

---

## Estimated Timeline

| Phase | Time | Cumulative |
|-------|------|------------|
| Phase 0: Pre-flight | 15 min | 15 min |
| Phase 1: LiveKit Server | 2 hours | 2h 15m |
| Phase 2: Phone Camera App | 3 hours | 5h 15m |
| Phase 3: Analysis Worker | 4 hours | 9h 15m |
| Phase 4: Web UI | 3 hours | 12h 15m |
| Phase 5: Integration & Test | 4 hours | 16h 15m |

**Total: ~16 hours of focused work**

**Realistic Schedule**: 3-4 days (accounting for breaks, debugging, learning)

---

## Success Metrics

### Minimum Viable Product (MVP)
- [ ] 5 phones can stream cameras
- [ ] Web UI shows all 5 camera feeds
- [ ] AI analysis produces scores
- [ ] Auto-switching works based on AI
- [ ] Manual override available
- [ ] System runs without crashes for 1 hour

### Performance Targets
- [ ] End-to-end latency < 2 seconds
- [ ] Camera → UI: < 500ms
- [ ] AI analysis: < 200ms per frame
- [ ] Switch decision: < 100ms
- [ ] GPU utilization: 60-80% (healthy)
- [ ] CPU per service: < 30%

### Quality Targets
- [ ] Switching feels natural (not too fast/slow)
- [ ] Correct camera selected >70% of time
- [ ] No dropped frames in normal operation
- [ ] Reconnects automatically after brief network issues

---

## Troubleshooting Guide

### Issue: LiveKit won't start
**Check**: Port 7880 not already in use
```bash
lsof -i :7880
docker-compose down
docker-compose up -d livekit-server
```

### Issue: Phone camera app can't connect
**Check**: HTTPS required on iOS
**Solution**: Use ngrok or add SSL cert
```bash
# Quick fix: Use Android phones first
# Or use ngrok:
ngrok http 3000
# Use ngrok URL in camera app
```

### Issue: Analysis worker crashes
**Check**: GPU memory
```bash
nvidia-smi
# If OOM: Use smaller models
YOLO_MODEL=yolo11n
VLM_LOAD_4BIT=true
```

### Issue: No switching happening
**Check**: Scores being published
```bash
docker-compose exec redis redis-cli
SUBSCRIBE scores.stream
# Should see messages when cameras are active
```

### Issue: Web UI shows black screens
**Check**: Browser WebRTC support
- Use Chrome/Firefox (not Safari on macOS < Sonoma)
- Check browser console for errors
- Verify camera permissions granted

---

## Next Steps After MVP

1. **Optimize**: Tune switching parameters for your use case
2. **Record**: Add recording to save best moments
3. **Enhance**: Add transitions, overlays, better TTS
4. **Scale**: Support more cameras, multiple rooms
5. **Deploy**: Move to production hardware/cloud

---

## Files Checklist

**Files to CREATE** (6 new files):
- [ ] `config/livekit/livekit.yaml`
- [ ] `web-obs/public/camera.html`
- [ ] `start-all.sh`
- [ ] `check-health.sh`
- [ ] `PHASE_COMPLETION.md` (track progress)

**Files to MODIFY** (8 files):
- [ ] `docker-compose.yml` (add LiveKit service)
- [ ] `.env` (update model names)
- [ ] `workers/analysis-worker/src/main.py` (LiveKit integration)
- [ ] `services/api-gateway/src/index.ts` (serve camera app)
- [ ] `services/api-gateway/package.json` (add dependencies)
- [ ] `web-obs/src/components/CameraGrid.tsx` (multi-camera)
- [ ] `web-obs/src/components/CameraPreview.tsx` (LiveKit tracks)
- [ ] `web-obs/src/components/ProgramMonitor.tsx` (active camera)

**Total**: 6 new + 8 modified = 14 files, ~850 lines of code

---

Ready to start implementation! 🚀
