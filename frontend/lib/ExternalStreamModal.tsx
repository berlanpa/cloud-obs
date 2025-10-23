'use client';

import React, { useState } from 'react';
import { Room } from 'livekit-client';
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
        video.muted = true;
        
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1280;
        canvas.height = 720;

        const stream = canvas.captureStream(30);
        
        // Publish the stream
        await room.localParticipant.publishTracks([
          new (await import('livekit-client')).LocalVideoTrack(stream.getVideoTracks()[0])
        ]);
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
      video.muted = true;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1280;
      canvas.height = 720;

      // Start playing the video and capturing frames
      video.play();
      
      const stream = canvas.captureStream(30);
      
      // Publish the stream
      await room.localParticipant.publishTracks([
        new (await import('livekit-client')).LocalVideoTrack(stream.getVideoTracks()[0])
      ]);

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

