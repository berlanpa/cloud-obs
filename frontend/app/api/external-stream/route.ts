import { NextRequest, NextResponse } from 'next/server';
import { LiveKit } from 'livekit-server-sdk';

const lk = new LiveKit(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);

export async function POST(request: NextRequest) {
  try {
    const { streamUrl, streamName, roomName } = await request.json();

    if (!streamUrl || !roomName) {
      return NextResponse.json(
        { error: 'Stream URL and room name are required' },
        { status: 400 }
      );
    }

    // Get the room
    const room = await lk.rooms.get(roomName);
    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Start RTMP input
    const rtmpInput = await room.startRtmpInput({
      url: streamUrl,
      name: streamName || 'External Stream',
      videoEnabled: true,
      audioEnabled: true,
    });

    return NextResponse.json({
      success: true,
      inputId: rtmpInput.id,
      message: 'External stream added successfully'
    });

  } catch (error) {
    console.error('Error adding external stream:', error);
    return NextResponse.json(
      { error: 'Failed to add external stream' },
      { status: 500 }
    );
  }
}

