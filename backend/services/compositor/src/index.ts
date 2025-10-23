/**
 * FFmpeg-based compositor service
 * Handles program feed composition with overlays and transitions
 */

import Fastify from 'fastify';
import Redis from 'ioredis';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { logger } from './logger';

interface CompositorConfig {
  port: number;
  redisUrl: string;
  livekitUrl: string;
  switchChannel: string;
  overlayPath: string;
  transitionType: 'cut' | 'dissolve';
  transitionDurationMs: number;
}

class CompositorService {
  private fastify: ReturnType<typeof Fastify>;
  private redis: Redis;
  private config: CompositorConfig;
  private currentCamera: string | null = null;
  private ffmpegProcess: ChildProcess | null = null;

  constructor(config: CompositorConfig) {
    this.config = config;
    this.fastify = Fastify({ logger: true });
    this.redis = new Redis(config.redisUrl);

    this.setupRoutes();
    this.subscribeToSwitchCommands();
  }

  private setupRoutes() {
    this.fastify.get('/health', async () => {
      return {
        status: 'healthy',
        currentCamera: this.currentCamera,
        ffmpegRunning: this.ffmpegProcess !== null
      };
    });

    this.fastify.get('/status', async () => {
      return {
        currentCamera: this.currentCamera,
        transitionType: this.config.transitionType,
        transitionDuration: this.config.transitionDurationMs
      };
    });
  }

  private async subscribeToSwitchCommands() {
    this.redis.subscribe(this.config.switchChannel, (err) => {
      if (err) {
        logger.error('Failed to subscribe to switch channel:', err);
        return;
      }
      logger.info(`Subscribed to ${this.config.switchChannel}`);
    });

    this.redis.on('message', async (channel, message) => {
      if (channel === this.config.switchChannel) {
        try {
          const switchCmd = JSON.parse(message);
          await this.handleSwitchCommand(switchCmd);
        } catch (error) {
          logger.error('Failed to handle switch command:', error);
        }
      }
    });
  }

  private async handleSwitchCommand(cmd: any) {
    const { to_cam, rationale } = cmd.payload || cmd;

    logger.info(`Switching to camera: ${to_cam} (reason: ${rationale})`);

    // Update current camera
    this.currentCamera = to_cam;

    // TODO: Implement actual FFmpeg stream switching
    // For now, this is a placeholder
    // Real implementation would:
    // 1. Get source stream URL for to_cam from LiveKit
    // 2. Apply transition (dissolve/cut)
    // 3. Add overlays (lower-thirds, logo)
    // 4. Publish composite to LiveKit as program feed

    // Example FFmpeg command structure:
    // ffmpeg -i <camera_source> \
    //        -i <overlay> \
    //        -filter_complex "[0:v][1:v]overlay=10:H-h-10" \
    //        -c:v libx264 -preset ultrafast -tune zerolatency \
    //        -f rtsp rtsp://livekit/program
  }

  private startFFmpegCompositor(cameraUrl: string) {
    // Placeholder for FFmpeg compositor
    // Real implementation would start FFmpeg process

    const overlayPath = this.config.overlayPath;

    const ffmpegArgs = [
      '-i', cameraUrl,
      '-i', path.join(overlayPath, 'lower-third.png'),
      '-filter_complex', '[0:v][1:v]overlay=10:H-h-10',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-f', 'rtsp',
      'rtsp://livekit/program'
    ];

    logger.info('Starting FFmpeg compositor');

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    this.ffmpegProcess.stdout?.on('data', (data) => {
      logger.debug(`FFmpeg stdout: ${data}`);
    });

    this.ffmpegProcess.stderr?.on('data', (data) => {
      logger.debug(`FFmpeg stderr: ${data}`);
    });

    this.ffmpegProcess.on('close', (code) => {
      logger.info(`FFmpeg process exited with code ${code}`);
      this.ffmpegProcess = null;
    });
  }

  private stopFFmpegCompositor() {
    if (this.ffmpegProcess) {
      logger.info('Stopping FFmpeg compositor');
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }
  }

  async start() {
    try {
      await this.fastify.listen({ port: this.config.port, host: '0.0.0.0' });
      logger.info(`Compositor service listening on port ${this.config.port}`);
    } catch (err) {
      logger.error('Error starting compositor service:', err);
      process.exit(1);
    }
  }

  async stop() {
    this.stopFFmpegCompositor();
    await this.redis.quit();
    await this.fastify.close();
  }
}

// Main entry point
const config: CompositorConfig = {
  port: parseInt(process.env.PORT || '3004'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  livekitUrl: process.env.LIVEKIT_URL || 'ws://localhost:7880',
  switchChannel: process.env.SWITCH_CHANNEL || 'switch.cmd',
  overlayPath: process.env.OVERLAY_PATH || './assets',
  transitionType: (process.env.TRANSITION_TYPE || 'dissolve') as 'cut' | 'dissolve',
  transitionDurationMs: parseInt(process.env.TRANSITION_MS || '300')
};

const compositorService = new CompositorService(config);

compositorService.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await compositorService.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await compositorService.stop();
  process.exit(0);
});
