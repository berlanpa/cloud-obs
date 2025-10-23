'use client';

import * as React from 'react';
import { useRoomContext, useIsRecording } from '@livekit/components-react';

export interface RecordingButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
}

export function RecordingButton({ onRecordingStart, onRecordingStop, ...props }: RecordingButtonProps) {
  const room = useRoomContext();
  const isRecording = useIsRecording();
  const [processingRecRequest, setProcessingRecRequest] = React.useState(false);
  const [showRecordingPanel, setShowRecordingPanel] = React.useState(false);

  const toggleRoomRecording = async () => {
    setProcessingRecRequest(true);
    
    try {
      let response: Response;
      if (isRecording) {
        response = await fetch(`/api/record/stop?roomName=${room.name}`);
        onRecordingStop?.();
      } else {
        response = await fetch('/api/record/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName: room.name,
          }),
        });
        onRecordingStart?.();
      }
      
      if (response.ok) {
        const data = await response.json();
        if (!isRecording) {
          // Show recording start information
          if (data.participantCount > 0) {
            const successCount = data.successfulRecordings || data.participantCount;
            alert(`Recording started! Recording ${successCount}/${data.participantCount} participant(s) separately. Files will be saved to S3 bucket: ${data.s3Bucket}`);
          } else {
            alert(`Recording started! Room composite recording will be saved to S3 bucket: ${data.s3Bucket}`);
          }
        } else {
          alert('Recording stopped successfully!');
        }
      } else {
        console.error('Error handling recording request:', response.status, response.statusText);
        alert('Failed to toggle recording. Please try again.');
      }
    } catch (error) {
      console.error('Recording error:', error);
      alert('Failed to toggle recording. Please try again.');
    } finally {
      setProcessingRecRequest(false);
    }
  };

  return (
    <div className="recording-controls" style={{ position: 'relative' }} {...props}>
      <button
        className="lk-button"
        onClick={() => setShowRecordingPanel(!showRecordingPanel)}
        style={{
          backgroundColor: isRecording ? '#dc3545' : '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '0.25rem',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        {isRecording ? '🔴' : '⏺️'} Recording
      </button>

      {showRecordingPanel && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '0.25rem',
            padding: '1rem',
            minWidth: '250px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            marginTop: '0.5rem',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Recording Controls</h3>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666' }}>
            {isRecording
              ? 'Meeting is currently being recorded to S3'
              : 'No active recordings for this meeting'}
          </p>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#888' }}>
                    Recordings are saved to S3 bucket: buildathongeome
                  </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              className="lk-button"
              onClick={() => setShowRecordingPanel(false)}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              className="lk-button"
              disabled={processingRecRequest}
              onClick={toggleRoomRecording}
              style={{
                backgroundColor: isRecording ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '0.25rem',
                padding: '0.5rem 1rem',
                cursor: processingRecRequest ? 'not-allowed' : 'pointer',
                opacity: processingRecRequest ? 0.6 : 1,
              }}
            >
              {processingRecRequest ? 'Processing...' : (isRecording ? 'Stop Recording' : 'Start Recording')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
