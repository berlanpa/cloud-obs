'use client';

import { useEffect, useRef } from 'react';
import { RemoteParticipant, RemoteVideoTrack, Track } from 'livekit-client';
import { useAppStore } from '@/store/appStore';

interface CameraPreviewProps {
  camera: {
    id: string;
    participant: RemoteParticipant;
    score: number;
    isProgram: boolean;
  };
}

export default function CameraPreview({ camera }: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { setCurrentProgram, manualMode } = useAppStore();

  useEffect(() => {
    if (!videoRef.current || !camera.participant) return;

    // Get video track publication
    const videoPublication = camera.participant.getTrack(Track.Source.Camera);

    if (videoPublication?.track) {
      const videoTrack = videoPublication.track as RemoteVideoTrack;

      // Attach track to video element
      videoTrack.attach(videoRef.current);

      return () => {
        if (videoRef.current) {
          videoTrack.detach(videoRef.current);
        }
      };
    }
  }, [camera.participant]);

  const handleClick = () => {
    if (manualMode) {
      setCurrentProgram(camera.id);
    }
  };

  return (
    <div
      className={`relative rounded-lg overflow-hidden border-2 ${
        camera.isProgram
          ? 'border-red-500'
          : 'border-gray-700 hover:border-gray-600'
      } ${manualMode ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="aspect-video bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      {/* Camera Label */}
      <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded text-xs">
        {camera.id}
      </div>

      {/* Score Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span>Score</span>
          <span className="font-mono">{camera.score.toFixed(3)}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-full rounded-full transition-all ${
              camera.isProgram ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${camera.score * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Program Indicator */}
      {camera.isProgram && (
        <div className="absolute top-2 right-2">
          <div className="bg-red-600 px-2 py-1 rounded text-xs font-bold">
            LIVE
          </div>
        </div>
      )}
    </div>
  );
}
