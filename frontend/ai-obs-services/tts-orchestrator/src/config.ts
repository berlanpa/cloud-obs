export const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  piper: {
    url: process.env.PIPER_URL || 'http://piper-tts:5000',
    speed: parseFloat(process.env.TTS_SPEED || '1.0'),  // 1.0 = normal, 0.8 = faster
  },

  livekit: {
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },

  narration: {
    maxWords: parseInt(process.env.MAX_NARRATION_WORDS || '12', 10),
    enabled: process.env.NARRATION_ENABLED !== 'false',
    maxLatencyMs: parseInt(process.env.MAX_TTS_LATENCY_MS || '600', 10),
  },

  server: {
    port: parseInt(process.env.PORT || '3002', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
