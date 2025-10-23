import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { createClient } from 'redis';
import { AccessToken } from 'livekit-server-sdk';
import { ApiResponse, CameraConfig, SystemConfig, WSEvent } from '@ai-obs/types';

const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  livekit: {
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

const redisClient = createClient({ url: config.redis.url });
const redisSubscriber = createClient({ url: config.redis.url });

async function main() {
  try {
    await redisClient.connect();
    await redisSubscriber.connect();
    fastify.log.info('Connected to Redis');

    // Register plugins
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    await fastify.register(websocket);

    // Serve static files (camera app)
    await fastify.register(fastifyStatic, {
      root: path.join(__dirname, '../../web-obs/public'),
      prefix: '/static/',
    });

    // Health check
    fastify.get('/health', async () => {
      return { status: 'ok', timestamp: Date.now() };
    });

    // Generate LiveKit token
    fastify.post<{
      Body: {
        identity: string;
        room: string;
        role: 'camera' | 'viewer' | 'producer';
      };
    }>('/token', async (request, reply) => {
      const { identity, room, role } = request.body;

      if (!identity || !room) {
        return reply.code(400).send({ error: 'Missing identity or room' });
      }

      const token = new AccessToken(
        config.livekit.apiKey,
        config.livekit.apiSecret,
        {
          identity,
          ttl: '1h',
        }
      );

      // Set grants based on role
      const grants = {
        room,
        roomJoin: true,
        canPublish: role === 'camera' || role === 'producer',
        canSubscribe: role === 'viewer' || role === 'producer',
        canPublishData: true,
        hidden: role === 'producer',
      };

      token.addGrant(grants);

      const jwt = await token.toJwt();

      const response: ApiResponse<{ token: string; url: string }> = {
        success: true,
        data: {
          token: jwt,
          url: config.livekit.url,
        },
        timestamp: Date.now(),
      };

      return response;
    });

    // Get system configuration
    fastify.get('/config', async () => {
      // In production, this would come from database
      const systemConfig: SystemConfig = {
        cameras: [
          { id: 'cam-1', name: 'Camera 1', enabled: true, position: 'wide' },
          { id: 'cam-2', name: 'Camera 2', enabled: true, position: 'close' },
          { id: 'cam-3', name: 'Camera 3', enabled: true, position: 'medium' },
          { id: 'cam-4', name: 'Camera 4', enabled: true, position: 'overhead' },
          { id: 'cam-5', name: 'Camera 5', enabled: true, position: 'side' },
        ],
        policy: {
          minHoldSec: 2.0,
          cooldownSec: 4.0,
          deltaSThreshold: 0.15,
          maxShotDurationSec: 15.0,
          enableHysteresis: true,
          enableCooldown: true,
          enableSpeechAlign: true,
        },
        vlm: {
          enabled: true,
          model: 'moondream',
          intervalMs: 700,
        },
        yolo: {
          model: 'yolov8n',
          confidenceThreshold: 0.5,
        },
        whisper: {
          model: 'base.en',
          language: 'en',
        },
        narration: {
          enabled: true,
          voiceId: 'eleven_monica',
          maxWords: 12,
        },
      };

      const response: ApiResponse<SystemConfig> = {
        success: true,
        data: systemConfig,
        timestamp: Date.now(),
      };

      return response;
    });

    // Serve camera app for phones
    fastify.get('/camera', async (request, reply) => {
      return reply.sendFile('camera.html');
    });

    // WebSocket endpoint for real-time events
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      fastify.log.info('WebSocket client connected');

      // Subscribe to Redis channels and forward to WebSocket
      const subscriber = createClient({ url: config.redis.url });

      subscriber.connect().then(() => {
        // Subscribe to all event streams
        subscriber.subscribe('switch.cmd', (message) => {
          const event: WSEvent = {
            type: 'switch',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });

        subscriber.subscribe('scores.stream', (message) => {
          const event: WSEvent = {
            type: 'score',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });

        subscriber.subscribe('narration.stream', (message) => {
          const event: WSEvent = {
            type: 'narration',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });

        subscriber.subscribe('program.changed', (message) => {
          const event: WSEvent = {
            type: 'status',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });
      });

      connection.socket.on('close', () => {
        fastify.log.info('WebSocket client disconnected');
        subscriber.quit();
      });

      connection.socket.on('error', (err) => {
        fastify.log.error({ err }, 'WebSocket error');
      });
    });

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(`API Gateway running on port ${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await redisClient.quit();
  await redisSubscriber.quit();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
