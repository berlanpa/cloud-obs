'use client';

import React, { useState } from 'react';
import { Room, Track } from 'livekit-client';
import { convertForLiveKit, convertForLiveKitFallback } from './convertForLiveKit';
import styles from '../styles/ExternalStreamModal.module.css';

interface ExternalStreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
}

export function ExternalStreamModal({ isOpen, onClose, room }: ExternalStreamModalProps) {
  const [streamUrl, setStreamUrl] = useState('');
  const [streamName, setStreamName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !streamUrl.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // For RTMP streams, you would typically use server-side API
      // For now, we'll handle file uploads or WebRTC streams
      if (streamUrl.startsWith('rtmp://') || streamUrl.startsWith('rtmps://')) {
        // Handle RTMP streams via server API
        const response = await fetch('/api/external-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamUrl,
            streamName: streamName || 'External Stream',
            roomName: room.name
          })
        });

        if (!response.ok) {
          throw new Error('Failed to add RTMP stream');
        }
      } else if (streamUrl.startsWith('http')) {
        // Handle HTTP video streams
      const video = document.createElement('video');
      video.src = streamUrl;
      video.crossOrigin = 'anonymous';
      video.muted = false; // Enable audio for external streams
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        // Use the new LiveKit converter for optimal color space handling
        let stream: MediaStream;
        try {
          // Try WebCodecs approach first (modern browsers)
          stream = await convertForLiveKit(video, {
            targetWidth: 1280,
            targetHeight: 720,
            frameRate: 30,
            enableHardwareAcceleration: true
          });
        } catch (error) {
          console.warn('WebCodecs not available, falling back to canvas method:', error);
          // Fallback to canvas method for older browsers
          stream = convertForLiveKitFallback(video, {
            targetWidth: 1280,
            targetHeight: 720,
            frameRate: 30
          });
        }
        
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        
        // Publish video track with custom name to distinguish from camera
        const currentUser = room.localParticipant.identity;
        await room.localParticipant.publishTrack(videoTrack, {
          name: `📹 ${streamName || 'External Stream'} (by ${currentUser})`,
          source: Track.Source.Camera
        });
        
        // Publish audio track if available
        if (audioTrack) {
          await room.localParticipant.publishTrack(audioTrack, {
            name: `🎵 ${streamName || 'External Stream'} Audio (by ${currentUser})`,
            source: Track.Source.Microphone
          });
        }
      }

      onClose();
      setStreamUrl('');
      setStreamName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add external stream');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;

    setIsLoading(true);
    setError('');

    try {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = false; // Enable audio for uploaded files
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      // Start playing the video
      video.play();
      
      // Use the new LiveKit converter for optimal color space handling
      let stream: MediaStream;
      try {
        // Try WebCodecs approach first (modern browsers)
        stream = await convertForLiveKit(video, {
          targetWidth: 1280,
          targetHeight: 720,
          frameRate: 30,
          enableHardwareAcceleration: true
        });
      } catch (error) {
        console.warn('WebCodecs not available, falling back to canvas method:', error);
        // Fallback to canvas method for older browsers
        stream = convertForLiveKitFallback(video, {
          targetWidth: 1280,
          targetHeight: 720,
          frameRate: 30
        });
      }
      
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      
      // Publish video track with custom name to distinguish from camera
      const currentUser = room.localParticipant.identity;
      await room.localParticipant.publishTrack(videoTrack, {
        name: `📹 Uploaded Video (by ${currentUser})`,
        source: Track.Source.Camera
      });
      
      // Publish audio track if available
      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, {
          name: `🎵 Uploaded Video Audio (by ${currentUser})`,
          source: Track.Source.Microphone
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Add External Stream</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="streamName">Stream Name (Optional)</label>
            <input
              id="streamName"
              type="text"
              value={streamName}
              onChange={(e) => setStreamName(e.target.value)}
              placeholder="My External Stream"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="streamUrl">Stream URL</label>
            <input
              id="streamUrl"
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="rtmp://example.com/live/stream or https://example.com/video.mp4"
              required
            />
          </div>

          <div className={styles.divider}>
            <span>OR</span>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="fileUpload">Upload Video File</label>
            <input
              id="fileUpload"
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className={styles.fileInput}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={isLoading || !streamUrl.trim()} className={styles.submitButton}>
              {isLoading ? 'Adding...' : 'Add Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

