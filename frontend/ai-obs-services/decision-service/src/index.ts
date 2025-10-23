import Fastify from 'fastify';
import { createClient } from 'redis';
import { config } from './config';
import { DecisionEngine } from './switcher';
import { CameraScore, RedisMessage, ScoreMessage, SwitchMessage } from '@ai-obs/types';

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

// Initialize Redis clients
const redisSubscriber = createClient({ url: config.redis.url });
const redisPublisher = createClient({ url: config.redis.url });

// Initialize decision engine
const decisionEngine = new DecisionEngine(config.policy, fastify.log as any);

// Process interval (Hz)
const DECISION_RATE_HZ = 10;
const DECISION_INTERVAL_MS = 1000 / DECISION_RATE_HZ;

async function main() {
  try {
    // Connect to Redis
    await redisSubscriber.connect();
    await redisPublisher.connect();
    fastify.log.info('Connected to Redis');

    // Subscribe to score updates
    await redisSubscriber.subscribe('scores.stream', async (message) => {
      try {
        const msg: RedisMessage = JSON.parse(message);

        if (msg.type === 'SCORE') {
          const scoreMsg = msg as ScoreMessage;
          decisionEngine.updateScore(scoreMsg.payload);
        }
      } catch (err) {
        fastify.log.error({ err }, 'Error processing score message');
      }
    });

    fastify.log.info('Subscribed to scores.stream');

    // Start decision loop
    setInterval(async () => {
      try {
        const decision = decisionEngine.decide();

        if (decision && decision.action === 'SWITCH') {
          // Publish switch decision
          const msg: SwitchMessage = {
            type: 'SWITCH',
            payload: decision,
          };

          await redisPublisher.publish('switch.cmd', JSON.stringify(msg));

          fastify.log.info({
            action: 'SWITCH_PUBLISHED',
            to: decision.toCam,
            from: decision.fromCam,
            score: decision.confidence,
          });
        }
      } catch (err) {
        fastify.log.error({ err }, 'Error in decision loop');
      }
    }, DECISION_INTERVAL_MS);

    // Health check endpoint
    fastify.get('/health', async () => {
      return {
        status: 'ok',
        currentCamera: decisionEngine.getCurrentCamera(),
        timestamp: Date.now(),
      };
    });

    // Status endpoint
    fastify.get('/status', async () => {
      return {
        state: decisionEngine.getState(),
        policy: config.policy,
      };
    });

    // Reset endpoint (for testing)
    fastify.post('/reset', async () => {
      decisionEngine.reset();
      return { status: 'reset' };
    });

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(`Decision service running on port ${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
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
