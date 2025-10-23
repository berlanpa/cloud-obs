'use client';

import { formatChatMessageLinks, RoomContext, VideoConference } from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  LogLevel,
  Room,
  RoomConnectOptions,
  RoomOptions,
  VideoPresets,
  type VideoCodec,
} from 'livekit-client';
import { DebugMode } from '@/lib/Debug';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardShortcuts } from '@/lib/KeyboardShortcuts';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { useSetupE2EE } from '@/lib/useSetupE2EE';
import { useLowCPUOptimizer } from '@/lib/usePerfomanceOptimiser';
import { Sidebar } from '@/lib/Sidebar';

export function VideoConferenceClientImpl(props: {
  liveKitUrl: string;
  token: string;
  codec: VideoCodec | undefined;
}) {
  const keyProvider = useMemo(() => new ExternalE2EEKeyProvider(), []);
  const { worker, e2eePassphrase } = useSetupE2EE();
  const e2eeEnabled = !!(e2eePassphrase && worker);

  const [e2eeSetupComplete, setE2eeSetupComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const roomOptions = useMemo((): RoomOptions => {
    return {
      publishDefaults: {
        videoSimulcastLayers: [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec: props.codec,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
    };
  }, [e2eeEnabled, props.codec, keyProvider, worker]);

  const room = useMemo(() => new Room(roomOptions), [roomOptions]);

  const connectOptions = useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  useEffect(() => {
    if (e2eeEnabled) {
      keyProvider.setKey(e2eePassphrase).then(() => {
        room.setE2EEEnabled(true).then(() => {
          setE2eeSetupComplete(true);
        });
      });
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, e2eePassphrase, keyProvider, room, setE2eeSetupComplete]);

  useEffect(() => {
    if (e2eeSetupComplete) {
      console.log('Connecting to room...', props.liveKitUrl);
      
      // Add timeout to prevent hanging
      const connectionTimeout = setTimeout(() => {
        console.error('Connection timeout after 10 seconds');
        setIsConnected(false);
      }, 10000);
      
      room.connect(props.liveKitUrl, props.token, connectOptions)
        .then(() => {
          clearTimeout(connectionTimeout);
          console.log('Room connected successfully, enabling camera and microphone...');
          setIsConnected(true);
          // Enable camera and microphone after successful connection
          return room.localParticipant.enableCameraAndMicrophone();
        })
        .then(() => {
          console.log('Camera and microphone enabled successfully');
        })
        .catch((error) => {
          clearTimeout(connectionTimeout);
          console.error('Connection or media enable error:', error);
          console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
          });
          setIsConnected(false);
        });
      
      // Screen sharing will be handled by user interaction
    }
  }, [room, props.liveKitUrl, props.token, connectOptions, e2eeSetupComplete]);

  useLowCPUOptimizer(room);


  return (
    <div className="lk-room-container" style={{ display: 'flex', height: '100vh' }}>
      <RoomContext.Provider value={room}>
        <Sidebar 
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div style={{
          flex: 1,
          marginLeft: sidebarCollapsed ? '48px' : '200px',
          transition: 'margin-left 0.3s ease',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <KeyboardShortcuts />
          {isConnected ? (
            <VideoConference
              chatMessageFormatter={formatChatMessageLinks}
              SettingsComponent={
                process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU === 'true' ? SettingsMenu : undefined
              }
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
              <div>Connecting to room...</div>
            </div>
          )}
          <DebugMode logLevel={LogLevel.debug} />
        </div>
      </RoomContext.Provider>
    </div>
  );
}
