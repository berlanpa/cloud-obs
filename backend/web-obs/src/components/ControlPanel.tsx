'use client';

import { useAppStore } from '@/store/appStore';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function ControlPanel() {
  const {
    manualMode,
    setManualMode,
    narrationEnabled,
    toggleNarration,
    lastSwitch,
  } = useAppStore();

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="font-semibold mb-4">Controls</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Auto/Manual Mode */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="text-sm text-gray-400 mb-2 block">
            Switching Mode
          </label>
          <button
            onClick={() => setManualMode(!manualMode)}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
              manualMode
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {manualMode ? (
              <div className="flex items-center justify-center gap-2">
                <Pause className="w-4 h-4" />
                <span>Manual</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Play className="w-4 h-4" />
                <span>Auto</span>
              </div>
            )}
          </button>
        </div>

        {/* Narration Toggle */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="text-sm text-gray-400 mb-2 block">
            Commentary
          </label>
          <button
            onClick={toggleNarration}
            className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
              narrationEnabled
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {narrationEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              <span>{narrationEnabled ? 'On' : 'Off'}</span>
            </div>
          </button>
        </div>

        {/* Last Switch Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <label className="text-sm text-gray-400 mb-2 block">
            Last Switch
          </label>
          <div className="text-sm">
            {lastSwitch ? (
              <div>
                <div className="font-mono text-green-400">
                  {lastSwitch.fromCam} → {lastSwitch.toCam}
                </div>
                <div className="text-gray-500 text-xs mt-1 line-clamp-2">
                  {lastSwitch.rationale}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">No switches yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
