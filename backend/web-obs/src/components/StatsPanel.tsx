'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { WSEvent } from '@ai-obs/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function StatsPanel() {
  const { updateScore, setLastSwitch, setWsConnected, setCurrentProgram } = useAppStore();
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    // Connect to WebSocket for real-time events
    const wsUrl = API_URL.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      addEvent('Connected to event stream');
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSEvent = JSON.parse(event.data);

        switch (msg.type) {
          case 'score':
            if (msg.payload.payload) {
              updateScore(msg.payload.payload);
            }
            break;

          case 'switch':
            if (msg.payload.payload) {
              setLastSwitch(msg.payload.payload);
              if (msg.payload.payload.toCam) {
                setCurrentProgram(msg.payload.payload.toCam);
              }
              addEvent(`Switch: ${msg.payload.payload.rationale}`);
            }
            break;

          case 'narration':
            if (msg.payload.payload?.text) {
              addEvent(`Narration: ${msg.payload.payload.text}`);
            }
            break;

          case 'status':
            if (msg.payload.payload?.camera) {
              setCurrentProgram(msg.payload.payload.camera);
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      addEvent('Disconnected from event stream');
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      addEvent('WebSocket error');
    };

    return () => {
      ws.close();
    };
  }, [updateScore, setLastSwitch, setWsConnected, setCurrentProgram]);

  const addEvent = (event: string) => {
    setEvents((prev) => [
      `${new Date().toLocaleTimeString()}: ${event}`,
      ...prev.slice(0, 9),
    ]);
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 h-full">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
        <h2 className="font-semibold">Event Log</h2>
      </div>
      <div className="p-4 space-y-2 h-[400px] overflow-y-auto">
        {events.length > 0 ? (
          events.map((event, i) => (
            <div
              key={i}
              className="text-sm text-gray-300 font-mono bg-gray-800 px-3 py-2 rounded"
            >
              {event}
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-500 text-center mt-8">
            No events yet
          </div>
        )}
      </div>
    </div>
  );
}
