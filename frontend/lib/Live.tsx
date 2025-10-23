'use client';

import React, { useState, useEffect } from 'react';
import { backendAPI } from './backend-api';
import { CameraScore, SwitchDecision, NarrationResult } from './backend-types';

interface LiveProps {
  className?: string;
}

export function Live({ className = '' }: LiveProps) {
  const [currentCamera, setCurrentCamera] = useState<string | null>(null);
  const [scores, setScores] = useState<CameraScore[]>([]);
  const [switches, setSwitches] = useState<SwitchDecision[]>([]);
  const [narrations, setNarrations] = useState<NarrationResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAutoMode, setIsAutoMode] = useState(true);

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

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
            return [...filtered, score].slice(-10); // Keep last 10 scores
          });
        },
        onSwitch: (decision) => {
          setSwitches(prev => [decision, ...prev].slice(-5)); // Keep last 5 switches
          if (decision.action === 'SWITCH' && decision.toCam) {
            setCurrentCamera(decision.toCam);
          }
        },
        onNarration: (narration) => {
          setNarrations(prev => [narration, ...prev].slice(-3)); // Keep last 3 narrations
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

  const getTopCamera = () => {
    if (scores.length === 0) return null;
    return scores.sort((a, b) => b.score - a.score)[0];
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    if (score >= 0.4) return 'text-orange-400';
    return 'text-red-400';
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

  const topCamera = getTopCamera();

  return (
    <div className={`p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Output</h1>
          <p className="text-gray-400">AI-directed camera switching and narration</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={() => setIsAutoMode(!isAutoMode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isAutoMode 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-700 text-white'
            }`}
          >
            {isAutoMode ? 'Auto Mode' : 'Manual Mode'}
          </button>
        </div>
      </div>

      {/* Main Live View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Program Output */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Program Output</h3>
            </div>
            <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
              {currentCamera ? (
                <div className="text-center">
                  <div className="text-6xl mb-4">📹</div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Camera {currentCamera.split('-')[1]}
                  </h2>
                  <p className="text-gray-400">Live Feed</p>
                  {isAutoMode && (
                    <div className="mt-4 px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
                      AI Directed
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">⏸️</div>
                  <p>No active camera</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Stats */}
        <div className="space-y-4">
          {/* Current Top Camera */}
          {topCamera && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Top Camera</h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-2">
                  Camera {topCamera.camId.split('-')[1]}
                </div>
                <div className={`text-2xl font-bold ${getScoreColor(topCamera.score)}`}>
                  {(topCamera.score * 100).toFixed(1)}%
                </div>
                <p className="text-gray-400 text-sm mt-2">{topCamera.reason}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {formatTimestamp(topCamera.timestamp)}
                </p>
              </div>
            </div>
          )}

          {/* Recent Switch */}
          {switches.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-3">Last Switch</h3>
              <div className="text-center">
                <div className="text-lg font-medium text-white mb-1">
                  {switches[0].action === 'SWITCH' 
                    ? `→ Camera ${switches[0].toCam?.split('-')[1]}`
                    : 'Hold Current'
                  }
                </div>
                <p className="text-gray-400 text-sm">{switches[0].rationale}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {formatTimestamp(switches[0].timestamp)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Narration */}
      {narrations.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Live Narration</h3>
          <div className="space-y-3">
            {narrations.map((narration, index) => (
              <div key={index} className="bg-gray-700 rounded p-4">
                <div className="flex items-start justify-between">
                  <p className="text-white text-lg leading-relaxed">{narration.text}</p>
                  <div className="text-right ml-4">
                    <div className="text-gray-400 text-sm">
                      {(narration.durationMs / 1000).toFixed(1)}s
                    </div>
                    <div className="text-gray-500 text-xs">
                      {formatTimestamp(narration.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Camera Scores Grid */}
      {scores.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">All Camera Scores</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {scores
              .sort((a, b) => b.score - a.score)
              .map(score => (
                <div 
                  key={score.camId} 
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    currentCamera === score.camId 
                      ? 'border-green-500 bg-green-500/10' 
                      : 'border-gray-600 bg-gray-700'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold text-white mb-1">
                      Camera {score.camId.split('-')[1]}
                    </div>
                    <div className={`text-xl font-bold ${getScoreColor(score.score)}`}>
                      {(score.score * 100).toFixed(1)}%
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{score.reason}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default Live;
