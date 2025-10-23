import Fastify from 'fastify';
import { createClient } from 'redis';
import { RoomServiceClient } from 'livekit-server-sdk';
import { RedisMessage, SwitchMessage } from '@ai-obs/types';

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
    port: parseInt(process.env.PORT || '3003', 10),
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

const redisSubscriber = createClient({ url: config.redis.url });
const redisPublisher = createClient({ url: config.redis.url });

// LiveKit Room Service Client for managing tracks
const livekitClient = new RoomServiceClient(
  config.livekit.url,
  config.livekit.apiKey,
  config.livekit.apiSecret
);

// Track current program feed
let currentProgramCam: string | null = null;

async function main() {
  try {
    await redisSubscriber.connect();
    await redisPublisher.connect();
    fastify.log.info('Connected to Redis');

    // Subscribe to switch commands
    await redisSubscriber.subscribe('switch.cmd', async (message) => {
      try {
        const msg: RedisMessage = JSON.parse(message);

        if (msg.type === 'SWITCH') {
          const switchMsg = msg as SwitchMessage;
          await handleSwitch(switchMsg.payload);
        }
      } catch (err) {
        fastify.log.error({ err }, 'Error processing switch message');
      }
    });

    fastify.log.info('Subscribed to switch commands');

    // Health endpoint
    fastify.get('/health', async () => {
      return {
        status: 'ok',
        currentProgram: currentProgramCam,
        timestamp: Date.now(),
      };
    });

    // Get current program endpoint
    fastify.get('/current', async () => {
      return {
        currentProgram: currentProgramCam,
      };
    });

    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(`Program Producer running on port ${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

async function handleSwitch(decision: any) {
  const { toCam } = decision;

  if (toCam === currentProgramCam) {
    return;
  }

  fastify.log.info({ from: currentProgramCam, to: toCam }, 'Switching program feed');

  // Update program track
  // In a real implementation, this would:
  // 1. Subscribe to the new camera's track
  // 2. Publish it as the "program" track
  // 3. Optionally apply transitions (dissolve, cut, etc.)

  currentProgramCam = toCam;

  // Publish program change event
  await redisPublisher.publish(
    'program.changed',
    JSON.stringify({
      type: 'PROGRAM_CHANGED',
      payload: {
        camera: toCam,
        timestamp: Date.now() / 1000,
      },
    })
  );

  fastify.log.info({ camera: toCam }, 'Program feed updated');
}

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await redisSubscriber.quit();
  await redisPublisher.quit();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
