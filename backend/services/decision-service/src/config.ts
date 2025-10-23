import { SwitchPolicy } from '@ai-obs/types';

export const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  postgres: {
    url: process.env.POSTGRES_URL || 'postgresql://aiobs:aiobs_dev@localhost:5432/aiobs',
  },

  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  policy: {
    minHoldSec: parseFloat(process.env.MIN_HOLD_SEC || '2.0'),
    cooldownSec: parseFloat(process.env.COOLDOWN_SEC || '4.0'),
    deltaSThreshold: parseFloat(process.env.DELTA_S_THRESHOLD || '0.15'),
    maxShotDurationSec: parseFloat(process.env.MAX_SHOT_DURATION_SEC || '15.0'),
    enableHysteresis: process.env.ENABLE_HYSTERESIS !== 'false',
    enableCooldown: process.env.ENABLE_COOLDOWN !== 'false',
    enableSpeechAlign: process.env.ENABLE_SPEECH_ALIGN !== 'false',
  } as SwitchPolicy,

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
