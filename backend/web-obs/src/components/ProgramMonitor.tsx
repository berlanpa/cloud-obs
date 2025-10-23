'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { useAppStore } from '@/store/appStore';
import { RemoteParticipant, RemoteVideoTrack, Track } from 'livekit-client';

export default function ProgramMonitor() {
  const { currentProgram } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const room = useRoomContext();
  const [activeParticipant, setActiveParticipant] = useState<RemoteParticipant | null>(null);

  // Find active camera participant
  useEffect(() => {
    if (!room || !currentProgram) return;

    // Get remote participants (filter out local participant)
    const remoteParticipants = Array.from(room.participants.values()).filter(
      (p) => p.identity !== room.localParticipant?.identity
    );
    const participant = remoteParticipants.find(
      (p) => p.identity === currentProgram
    ) as RemoteParticipant | undefined;
    setActiveParticipant(participant || null);
  }, [room, currentProgram]);

  // Attach video track
  useEffect(() => {
    if (!videoRef.current || !activeParticipant) return;

    const videoPublication = activeParticipant.getTrack(Track.Source.Camera);
    if (videoPublication?.track) {
      const videoTrack = videoPublication.track as RemoteVideoTrack;
      const element = videoRef.current;
      videoTrack.attach(element);

      return () => {
        if (element) {
          videoTrack.detach(element);
        }
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
