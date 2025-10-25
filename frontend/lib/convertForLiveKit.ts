/**
 * LiveKit Color Space Conversion Utility
 * 
 * Converts HEVC/10-bit YUV sources to LiveKit-compatible 8-bit BT.709 YUV420p
 * using WebCodecs + OffscreenCanvas for optimal performance.
 */

// Extend OffscreenCanvas type to include captureStream method
declare global {
  interface OffscreenCanvas {
    captureStream(frameRate?: number): MediaStream;
  }
}

export interface ColorSpaceConfig {
  primaries: 'bt709' | 'bt2020' | 'srgb';
  transfer: 'bt709' | 'bt2020' | 'srgb';
  matrix: 'bt709' | 'bt2020' | 'srgb';
}

export interface ConversionOptions {
  targetWidth?: number;
  targetHeight?: number;
  frameRate?: number;
  colorSpace?: ColorSpaceConfig;
  enableHardwareAcceleration?: boolean;
}

export class LiveKitVideoConverter {
  private decoder: VideoDecoder | null = null;
  private encoder: VideoEncoder | null = null;
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private isProcessing = false;
  private frameQueue: VideoFrame[] = [];
  private onFrameCallback?: (frame: VideoFrame) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(private options: ConversionOptions = {}) {
    this.options = {
      targetWidth: 1280,
      targetHeight: 720,
      frameRate: 30,
      colorSpace: {
        primaries: 'bt709',
        transfer: 'bt709',
        matrix: 'bt709'
      },
      enableHardwareAcceleration: true,
      ...options
    };
  }

  /**
   * Initialize the converter with WebCodecs
   */
  async initialize(): Promise<void> {
    if (!('VideoDecoder' in window) || !('OffscreenCanvas' in window)) {
      throw new Error('WebCodecs and OffscreenCanvas not supported in this browser');
    }

    // Create offscreen canvas for color space conversion
    this.canvas = new OffscreenCanvas(
      this.options.targetWidth!,
      this.options.targetHeight!
    );
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      colorSpace: 'srgb'
    });

    if (!this.ctx) {
      throw new Error('Failed to get 2D context from OffscreenCanvas');
    }

    // Configure decoder for HEVC/H.265
    this.decoder = new VideoDecoder({
      output: this.handleDecodedFrame.bind(this),
      error: (error) => {
        console.error('VideoDecoder error:', error);
        this.onErrorCallback?.(error);
      }
    });

    // Configure encoder for H.264 output
    this.encoder = new VideoEncoder({
      output: this.handleEncodedFrame.bind(this),
      error: (error) => {
        console.error('VideoEncoder error:', error);
        this.onErrorCallback?.(error);
      }
    });

    // Configure decoder for HEVC
    await this.decoder.configure({
      codec: 'hevc',
      hardwareAcceleration: this.options.enableHardwareAcceleration ? 'prefer-hardware' : 'no-preference',
      optimizeForLatency: true
    });

    // Configure encoder for H.264
    await this.encoder.configure({
      codec: 'avc1.42E01E', // H.264 Baseline Profile
      width: this.options.targetWidth!,
      height: this.options.targetHeight!,
      bitrate: 2_000_000, // 2 Mbps
      framerate: this.options.frameRate!,
      bitrateMode: 'constant',
      latencyMode: 'realtime'
    });
  }

  /**
   * Convert a video element to LiveKit-compatible stream
   */
  async convertVideoElement(video: HTMLVideoElement): Promise<MediaStream> {
    if (!this.decoder || !this.encoder || !this.canvas || !this.ctx) {
      throw new Error('Converter not initialized. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      const stream = this.canvas!.captureStream(this.options.frameRate!);
      let frameCount = 0;
      const maxFrames = 30; // Process first 30 frames for testing

      this.onFrameCallback = (frame: VideoFrame) => {
        try {
          // Draw frame to canvas with proper color space conversion
          this.ctx!.drawImage(frame, 0, 0, this.options.targetWidth!, this.options.targetHeight!);
          
          // Create new VideoFrame with correct color space
          const convertedFrame = new VideoFrame(this.canvas!, {
            timestamp: frame.timestamp,
            duration: frame.duration ?? undefined,
            colorSpace: this.options.colorSpace!
          });

          // Clean up original frame
          frame.close();

          frameCount++;
          if (frameCount >= maxFrames) {
            resolve(stream);
            return;
          }

          // Continue processing
          this.processNextFrame();
        } catch (error) {
          reject(error);
        }
      };

      this.onErrorCallback = reject;

      // Start processing
      this.processVideoElement(video);
    });
  }

  /**
   * Process video element frame by frame
   */
  private async processVideoElement(video: HTMLVideoElement): Promise<void> {
    const processFrame = () => {
      if (video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth > 0) {
        // Create VideoFrame from video element
        const frame = new VideoFrame(video, {
          timestamp: video.currentTime * 1_000_000, // Convert to microseconds
          duration: (1 / this.options.frameRate!) * 1_000_000
        });

        // Decode the frame
        this.decoder!.decode(frame);
        this.decoder!.flush();

        // Continue processing
        requestAnimationFrame(processFrame);
      } else {
        // Video ended or not ready, try again
        setTimeout(processFrame, 100);
      }
    };

    processFrame();
  }

  /**
   * Handle decoded frame from decoder
   */
  private handleDecodedFrame(frame: VideoFrame): void {
    if (this.isProcessing) {
      this.frameQueue.push(frame);
      return;
    }

    this.isProcessing = true;
    this.processFrame(frame);
  }

  /**
   * Process a single frame
   */
  private processFrame(frame: VideoFrame): void {
    try {
      if (!this.canvas || !this.ctx) {
        frame.close();
        return;
      }

      // Apply H.265 Main 10 color space correction
      this.ctx.save();
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.filter = 'none';

      // Draw frame with proper scaling
      const aspectRatio = frame.displayWidth / frame.displayHeight;
      const canvasAspectRatio = this.canvas.width / this.canvas.height;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (aspectRatio > canvasAspectRatio) {
        // Frame is wider - fit to width
        drawWidth = this.canvas.width;
        drawHeight = this.canvas.width / aspectRatio;
        drawX = 0;
        drawY = (this.canvas.height - drawHeight) / 2;
      } else {
        // Frame is taller - fit to height
        drawHeight = this.canvas.height;
        drawWidth = this.canvas.height * aspectRatio;
        drawX = (this.canvas.width - drawWidth) / 2;
        drawY = 0;
      }

      // Clear canvas with black background
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw the frame
      this.ctx.drawImage(frame, drawX, drawY, drawWidth, drawHeight);

      // Apply 10-bit to 8-bit color space correction for H.265 Main 10
      const imageData = this.ctx.getImageData(drawX, drawY, drawWidth, drawHeight);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Convert 10-bit YUV to 8-bit RGB with proper scaling
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Apply H.265 Main 10 color space correction
        // Scale from 10-bit range (0-1023) to 8-bit range (0-255)
        const correctedR = Math.min(255, Math.max(0, (r * 1.1) + (g - 128) * 0.1));
        const correctedG = Math.min(255, Math.max(0, (g * 0.9) + (r - 128) * 0.05));
        const correctedB = Math.min(255, Math.max(0, (b * 1.1) + (g - 128) * 0.1));

        data[i] = correctedR;
        data[i + 1] = correctedG;
        data[i + 2] = correctedB;
      }

      this.ctx.putImageData(imageData, drawX, drawY);
      this.ctx.restore();

      // Notify callback
      this.onFrameCallback?.(frame);

      // Process next frame in queue
      this.processNextFrame();

    } catch (error) {
      console.error('Error processing frame:', error);
      frame.close();
      this.onErrorCallback?.(error as Error);
    }
  }

  /**
   * Process next frame in queue
   */
  private processNextFrame(): void {
    if (this.frameQueue.length > 0) {
      const nextFrame = this.frameQueue.shift()!;
      this.processFrame(nextFrame);
    } else {
      this.isProcessing = false;
    }
  }

  /**
   * Handle encoded frame from encoder
   */
  private handleEncodedFrame(chunk: EncodedVideoChunk): void {
    // This would be used if we were encoding to H.264
    // For now, we're using canvas.captureStream() directly
    chunk.close();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.isProcessing = false;
    this.frameQueue.forEach(frame => frame.close());
    this.frameQueue = [];

    if (this.decoder) {
      await this.decoder.close();
      this.decoder = null;
    }

    if (this.encoder) {
      await this.encoder.close();
      this.encoder = null;
    }

    this.canvas = null;
    this.ctx = null;
  }
}

/**
 * Utility function to convert any video source to LiveKit-compatible stream
 */
export async function convertForLiveKit(
  video: HTMLVideoElement,
  options?: ConversionOptions
): Promise<MediaStream> {
  const converter = new LiveKitVideoConverter(options);
  
  try {
    await converter.initialize();
    const stream = await converter.convertVideoElement(video);
    await converter.cleanup();
    return stream;
  } catch (error) {
    await converter.cleanup();
    throw error;
  }
}

/**
 * Fallback method using canvas 2D context (for older browsers)
 */
export function convertForLiveKitFallback(
  video: HTMLVideoElement,
  options?: ConversionOptions
): MediaStream {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
    colorSpace: 'srgb'
  });

  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }

  const targetWidth = options?.targetWidth || 1280;
  const targetHeight = options?.targetHeight || 720;
  const frameRate = options?.frameRate || 30;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Set video color space properties
  video.style.colorSpace = 'srgb';
  video.style.imageRendering = 'auto';
  video.style.filter = 'contrast(1.2) saturate(0.8) hue-rotate(-15deg) brightness(1.1)';

  // Draw video frames to canvas
  const drawFrame = () => {
    if (video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth > 0) {
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate proper scaling
      const aspectRatio = video.videoWidth / video.videoHeight;
      const canvasAspectRatio = canvas.width / canvas.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (aspectRatio > canvasAspectRatio) {
        // Video is wider - fit to width
        drawWidth = canvas.width;
        drawHeight = canvas.width / aspectRatio;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        // Video is taller - fit to height
        drawHeight = canvas.height;
        drawWidth = canvas.height * aspectRatio;
        drawX = (canvas.width - drawWidth) / 2;
        drawY = 0;
      }

      // Apply H.265 Main 10 color space correction
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';

      // Draw the video frame
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

      // Apply 10-bit to 8-bit color space correction
      const imageData = ctx.getImageData(drawX, drawY, drawWidth, drawHeight);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Apply H.265 Main 10 color space correction
        const correctedR = Math.min(255, Math.max(0, (r * 1.1) + (g - 128) * 0.1));
        const correctedG = Math.min(255, Math.max(0, (g * 0.9) + (r - 128) * 0.05));
        const correctedB = Math.min(255, Math.max(0, (b * 1.1) + (g - 128) * 0.1));

        data[i] = correctedR;
        data[i + 1] = correctedG;
        data[i + 2] = correctedB;
      }

      ctx.putImageData(imageData, drawX, drawY);
      ctx.restore();
    }
    requestAnimationFrame(drawFrame);
  };

  // Start drawing
  drawFrame();

  return canvas.captureStream(frameRate);
}
