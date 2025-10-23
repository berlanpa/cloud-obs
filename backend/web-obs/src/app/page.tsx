'use client';

import { useEffect, useState } from 'react';
import { Room } from 'livekit-client';
import { LiveKitRoom } from '@livekit/components-react';
import ProgramMonitor from '@/components/ProgramMonitor';
import CameraGrid from '@/components/CameraGrid';
import ControlPanel from '@/components/ControlPanel';
import StatsPanel from '@/components/StatsPanel';
import { useAppStore } from '@/store/appStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';

export default function Home() {
  const [token, setToken] = useState<string>('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Get LiveKit token
    fetch(`${API_URL}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: `viewer-${Date.now()}`,
        room: 'main',
        role: 'viewer',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setToken(data.data.token);
        }
      })
      .catch((err) => console.error('Failed to get token:', err));
  }, []);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to LiveKit...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LIVEKIT_URL}
      connect={true}
      onConnected={() => setConnected(true)}
      onDisconnected={() => setConnected(false)}
    >
      <Main connected={connected} />
    </LiveKitRoom>
  );
}

function Main({ connected }: { connected: boolean }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">AI-OBS</h1>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-green-500' : 'bg-red-500'
                }`}
              ></div>
              <span className="text-sm text-gray-400">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/cameras"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition font-medium text-sm"
            >
              📱 Connect Cameras
            </a>
            <div className="text-sm text-gray-400">
              Intelligent Auto-Director
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="p-6 space-y-6">
        {/* Top: Program Monitor */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ProgramMonitor />
          </div>
          <div>
            <StatsPanel />
          </div>
        </div>

        {/* Middle: Camera Previews */}
        <CameraGrid />

        {/* Bottom: Controls */}
        <ControlPanel />
      </div>
    </div>
  );
}
