'use client';

import { useRoomContext } from '@livekit/components-react';
import { useAppStore } from '@/store/appStore';
import CameraPreview from './CameraPreview';
import { useState, useEffect } from 'react';
import { RemoteParticipant, RoomEvent } from 'livekit-client';

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
    Array.from(room.participants.values()).forEach(handleParticipantConnected);

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
