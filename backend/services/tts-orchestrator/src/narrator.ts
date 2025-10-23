import { NarrationContext, NarrationResult } from '@ai-obs/types';
import WebSocket from 'ws';

// Use a compatible logger interface that works with both Pino and Fastify
interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

export class NarrationGenerator {
  private logger: Logger;
  private maxWords: number;

  constructor(maxWords: number, logger: Logger) {
    this.maxWords = maxWords;
    this.logger = logger;
  }

  /**
   * Generate narration text from context using simple templates.
   */
  generateText(context: NarrationContext): string {
    const { vlmTags, yoloTop, whisperDelta, chosenCam } = context;

    // Safety check
    if (context.safety.pii || context.safety.profanity) {
      return this.getGenericNarration(chosenCam);
    }

    // Build narration from available context
    let narration = '';

    // Check for VLM tags first (most semantic)
    if (vlmTags.length > 0) {
      narration = this.buildFromVLM(vlmTags, chosenCam);
    } else if (yoloTop.length > 0) {
      narration = this.buildFromYOLO(yoloTop, chosenCam);
    } else if (whisperDelta) {
      narration = this.buildFromWhisper(whisperDelta, chosenCam);
    } else {
      narration = this.getGenericNarration(chosenCam);
    }

    // Ensure word limit
    const words = narration.split(' ');
    if (words.length > this.maxWords) {
      narration = words.slice(0, this.maxWords).join(' ') + '.';
    }

    return narration;
  }

  private buildFromVLM(tags: string[], camId: string): string {
    // Map tags to natural descriptions
    const tagMap: Record<string, string> = {
      'close-up': 'Close-up view',
      'wide-shot': 'Wide shot',
      'gesture': 'Speaker gesturing',
      'speaking': 'Speaker presenting',
      'audience': 'Audience view',
      'face-visible': 'Face in view',
      'high-motion': 'Active scene',
    };

    const descriptions = tags
      .slice(0, 2)
      .map((tag) => tagMap[tag] || tag)
      .join(', ');

    if (descriptions) {
      return `Switching to camera ${this.getCameraName(camId)}: ${descriptions}.`;
    }

    return this.getGenericNarration(camId);
  }

  private buildFromYOLO(objects: string[], camId: string): string {
    // Extract main objects
    const mainObjects = objects.slice(0, 2).join(' and ');

    if (mainObjects.includes('person')) {
      return `Switching to camera ${this.getCameraName(camId)}: Person in frame.`;
    }

    return `Switching to camera ${this.getCameraName(camId)}: ${mainObjects} detected.`;
  }

  private buildFromWhisper(transcript: string, camId: string): string {
    // Use last few words of transcript
    const words = transcript.trim().split(' ').slice(-5).join(' ');

    if (words) {
      return `Switching to camera ${this.getCameraName(camId)}: "${words}..."`;
    }

    return this.getGenericNarration(camId);
  }

  private getGenericNarration(camId: string): string {
    return `Switching to camera ${this.getCameraName(camId)}.`;
  }

  private getCameraName(camId: string): string {
    // Extract camera number or name
    const match = camId.match(/\d+/);
    return match ? match[0] : camId;
  }
}

export class PiperTTS {
  private piperUrl: string;
  private logger: Logger;
  private speed: number;

  constructor(piperUrl: string, logger: Logger, speed: number = 1.0) {
    this.piperUrl = piperUrl;
    this.logger = logger;
    this.speed = speed;
  }

  /**
   * Synthesize text to speech using local Piper TTS service.
   * Returns audio buffer (WAV format).
   */
  async synthesize(text: string, maxLatencyMs: number): Promise<Buffer | null> {
    const startTime = Date.now();

    try {
      this.logger.info({ text: text.substring(0, 50) }, 'Synthesizing speech with Piper');

      const response = await fetch(`${this.piperUrl}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          length_scale: this.speed,  // 1.0 = normal, 0.8 = faster, 1.2 = slower
          noise_scale: 0.667,
          noise_w: 0.8,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Piper TTS error: ${response.statusText} - ${error}`);
      }

      // Check latency
      const latency = Date.now() - startTime;
      if (latency > maxLatencyMs) {
        this.logger.warn({ latency, maxLatencyMs }, 'TTS latency exceeded threshold');
        return null;
      }

      // Get audio buffer (WAV format)
      const audioBuffer = Buffer.from(await response.arrayBuffer());

      // Get duration from header
      const duration = response.headers.get('X-Audio-Duration');

      this.logger.info({
        latency,
        audioSize: audioBuffer.length,
        duration: duration ? parseFloat(duration) : 'unknown',
      }, 'Speech synthesized successfully');

      return audioBuffer;
    } catch (err) {
      this.logger.error({ err }, 'Piper TTS synthesis failed');
      return null;
    }
  }

  /**
   * Test connection to Piper service.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.piperUrl}/health`);
      const data = (await response.json()) as { status: string; model_loaded: boolean };
      this.logger.info({ piperHealth: data }, 'Piper TTS health check');
      return data.status === 'ok' && data.model_loaded;
    } catch (err) {
      this.logger.error({ err }, 'Piper TTS health check failed');
      return false;
    }
  }
}
