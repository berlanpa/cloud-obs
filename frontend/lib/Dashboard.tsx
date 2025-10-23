'use client';

import React, { useState, useEffect } from 'react';
import { backendAPI } from './backend-api';
import { SystemConfig, CameraScore, SwitchDecision, NarrationResult } from './backend-types';

interface DashboardProps {
  className?: string;
}

export function Dashboard({ className = '' }: DashboardProps) {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [scores, setScores] = useState<CameraScore[]>([]);
  const [switches, setSwitches] = useState<SwitchDecision[]>([]);
  const [narrations, setNarrations] = useState<NarrationResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load initial config
    loadConfig();

    // Connect to WebSocket
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const loadConfig = async () => {
    try {
      const response = await backendAPI.getConfig();
      if (response.success) {
        setConfig(response.data!);
      }
    } catch (err) {
      setError(`Failed to load config: ${err}`);
    }
  };

  const connectWebSocket = () => {
    try {
      const websocket = backendAPI.createWebSocketConnection();
      
      websocket.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      websocket.onclose = () => {
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };

      websocket.onerror = (error) => {
        setError('WebSocket connection error');
        console.error('WebSocket error:', error);
      };

      const cleanup = backendAPI.onWebSocketEvent(websocket, {
        onScore: (score) => {
          setScores(prev => {
            const filtered = prev.filter(s => s.camId !== score.camId);
            return [...filtered, score].slice(-20); // Keep last 20 scores
          });
        },
        onSwitch: (decision) => {
          setSwitches(prev => [decision, ...prev].slice(-10)); // Keep last 10 switches
        },
        onNarration: (narration) => {
          setNarrations(prev => [narration, ...prev].slice(-5)); // Keep last 5 narrations
        },
        onStatus: (status) => {
          console.log('Status update:', status);
        },
        onError: (error) => {
          setError(`Backend error: ${error}`);
        }
      });

      setWs(websocket);
    } catch (err) {
      setError(`Failed to connect to backend: ${err}`);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold mb-2">Connection Error</h3>
          <p className="text-red-300 text-sm">{error}</p>
          <button 
            onClick={connectWebSocket}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Director Dashboard</h1>
          <p className="text-gray-400">Real-time analysis and switching decisions</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* System Status */}
      {config && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Cameras</h3>
            <div className="space-y-2">
              {config.cameras.map(camera => (
                <div key={camera.id} className="flex items-center justify-between">
                  <span className="text-gray-300">{camera.name}</span>
                  <div className={`w-2 h-2 rounded-full ${camera.enabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">AI Models</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">YOLO:</span>
                <span className="text-white">{config.yolo.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">VLM:</span>
                <span className="text-white">{config.vlm.enabled ? config.vlm.model : 'Disabled'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Whisper:</span>
                <span className="text-white">{config.whisper.model}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Switching Policy</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Min Hold:</span>
                <span className="text-white">{config.policy.minHoldSec}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Cooldown:</span>
                <span className="text-white">{config.policy.cooldownSec}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Threshold:</span>
                <span className="text-white">{config.policy.deltaSThreshold}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Scores */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Live Camera Scores</h3>
          <div className="space-y-3">
            {scores.length === 0 ? (
              <p className="text-gray-400 text-sm">No scores available yet...</p>
            ) : (
              scores
                .sort((a, b) => b.score - a.score)
                .map(score => (
                  <div key={`${score.camId}-${score.timestamp}`} className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Camera {score.camId.split('-')[1]}</span>
                      <p className="text-gray-400 text-xs">{score.reason}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${getScoreColor(score.score)}`}>
                        {(score.score * 100).toFixed(1)}%
                      </span>
                      <p className="text-gray-400 text-xs">{formatTimestamp(score.timestamp)}</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Recent Switches */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Switches</h3>
          <div className="space-y-3">
            {switches.length === 0 ? (
              <p className="text-gray-400 text-sm">No switches yet...</p>
            ) : (
              switches.map((switch_, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium">
                      {switch_.action === 'SWITCH' 
                        ? `Switch to Camera ${switch_.toCam?.split('-')[1]}`
                        : 'Hold Current'
                      }
                    </span>
                    <p className="text-gray-400 text-xs">{switch_.rationale}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 text-sm">
                      {switch_.confidence ? `${(switch_.confidence * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                    <p className="text-gray-400 text-xs">{formatTimestamp(switch_.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Narration */}
      {narrations.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Narration</h3>
          <div className="space-y-3">
            {narrations.map((narration, index) => (
              <div key={index} className="bg-gray-700 rounded p-3">
                <p className="text-white">{narration.text}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400 text-xs">
                    Duration: {(narration.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-gray-400 text-xs">
                    {formatTimestamp(narration.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
