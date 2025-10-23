import Fastify from 'fastify';
import { createClient } from 'redis';
import { AccessToken } from 'livekit-server-sdk';
import { config } from './config';
import { NarrationGenerator, PiperTTS } from './narrator';
import {
  RedisMessage,
  SwitchMessage,
  NarrationContext,
  NarrationMessage,
  ScoreMessage,
  CameraScore,
} from '@ai-obs/types';

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

// Initialize clients
const redisSubscriber = createClient({ url: config.redis.url });
const redisPublisher = createClient({ url: config.redis.url });

// Initialize narration components
const narrator = new NarrationGenerator(config.narration.maxWords, fastify.log);
const tts = new PiperTTS(
  config.piper.url,
  fastify.log,
  config.piper.speed
);

// Store recent scores and context
const recentScores: Map<string, CameraScore> = new Map();
const contextWindow = 5000; // 5 seconds

async function main() {
  try {
    // Connect to Redis
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

    // Also subscribe to scores to build context
    await redisSubscriber.subscribe('scores.stream', async (message) => {
      try {
        const msg: RedisMessage = JSON.parse(message);

        if (msg.type === 'SCORE') {
          const scoreMsg = msg as ScoreMessage;
          recentScores.set(scoreMsg.payload.camId, scoreMsg.payload);

          // Clean old scores
          const now = Date.now() / 1000;
          for (const [camId, score] of recentScores.entries()) {
            if (now - score.timestamp > contextWindow / 1000) {
              recentScores.delete(camId);
            }
          }
        }
      } catch (err) {
        fastify.log.error({ err }, 'Error processing score message');
      }
    });

    fastify.log.info('Subscribed to Redis channels');

    // Health endpoint
    fastify.get('/health', async () => {
      return {
        status: 'ok',
        narrationEnabled: config.narration.enabled,
        timestamp: Date.now(),
      };
    });

    // Manual narration endpoint (for testing)
    fastify.post<{ Body: { text: string } }>('/narrate', async (request, reply) => {
      const { text } = request.body;

      if (!text) {
        return reply.code(400).send({ error: 'Text required' });
      }

      const audio = await tts.synthesize(text, config.narration.maxLatencyMs);

      if (!audio) {
        return reply.code(500).send({ error: 'TTS failed' });
      }

      return {
        success: true,
        audioSize: audio.length,
      };
    });

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    fastify.log.info(`TTS Orchestrator running on port ${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

async function handleSwitch(decision: any) {
  if (!config.narration.enabled) {
    return;
  }

  const { toCam, reason } = decision;

  // Build context from recent scores
  const chosenScore = recentScores.get(toCam);

  if (!chosenScore) {
    fastify.log.warn({ toCam }, 'No score found for chosen camera');
    return;
  }

  const context: NarrationContext = {
    timestamp: Date.now() / 1000,
    timeWindow: [Date.now() / 1000 - 3, Date.now() / 1000],
    chosenCam: toCam,
    vlmTags: chosenScore.features.vlmTags || [],
    yoloTop: Object.keys(chosenScore.features.objectCounts || {}).slice(0, 3),
    whisperDelta: chosenScore.features.keywords?.join(', ') || '',
    reason,
    safety: {
      pii: false,
      profanity: false,
    },
  };

  // Generate narration text
  const narrationText = narrator.generateText(context);

  fastify.log.info({ narrationText, toCam }, 'Generated narration');

  // Synthesize speech
  const startTime = Date.now();
  const audio = await tts.synthesize(narrationText, config.narration.maxLatencyMs);

  if (!audio) {
    fastify.log.warn('TTS synthesis failed or exceeded latency threshold');
    return;
  }

  const durationMs = Date.now() - startTime;

  // Publish narration result
  const narrationResult: NarrationMessage = {
    type: 'NARRATION',
    payload: {
      text: narrationText,
      durationMs,
      timestamp: Date.now() / 1000,
    },
  };

  await redisPublisher.publish('narration.stream', JSON.stringify(narrationResult));

  fastify.log.info({
    text: narrationText,
    durationMs,
    audioSize: audio.length,
  }, 'Narration published');

  // TODO: Publish audio to LiveKit as a commentary track
  // This requires implementing LiveKit audio track publishing
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
