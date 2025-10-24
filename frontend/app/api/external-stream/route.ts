import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { streamUrl, streamName, roomName } = await request.json();

    if (!streamUrl || !roomName) {
      return NextResponse.json(
        { error: 'Stream URL and room name are required' },
        { status: 400 }
      );
    }

    // For now, RTMP input is not supported in the current LiveKit server SDK
    // The external stream functionality is handled client-side through video upload
    return NextResponse.json({
      success: false,
      message: 'RTMP input is not currently supported. Please use the video upload feature instead.'
    });

  } catch (error) {
    console.error('Error adding external stream:', error);
    return NextResponse.json(
      { error: 'Failed to add external stream' },
      { status: 500 }
    );
  }
}

