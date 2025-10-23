import { CameraScore, SwitchDecision, SwitchPolicy } from '@ai-obs/types';
import { Logger } from 'pino';

interface SwitchState {
  currentCam: string | null;
  lastSwitchTime: number;
  switchHistory: Array<{ cam: string; time: number }>;
  cooldowns: Map<string, number>;
}

export class DecisionEngine {
  private state: SwitchState;
  private scores: Map<string, CameraScore>;
  private logger: Logger;
  private policy: SwitchPolicy;

  constructor(policy: SwitchPolicy, logger: Logger) {
    this.policy = policy;
    this.logger = logger;

    this.state = {
      currentCam: null,
      lastSwitchTime: 0,
      switchHistory: [],
      cooldowns: new Map(),
    };

    this.scores = new Map();
  }

  updateScore(score: CameraScore): void {
    this.scores.set(score.camId, score);
  }

  /**
   * Make a switching decision based on current scores.
   */
  decide(): SwitchDecision | null {
    const now = Date.now() / 1000;

    // Need at least one camera
    if (this.scores.size === 0) {
      return null;
    }

    // Find best camera
    const candidates = Array.from(this.scores.values());
    const best = this.findBestCamera(candidates, now);

    if (!best) {
      return null;
    }

    // If no current camera, switch immediately
    if (!this.state.currentCam) {
      return this.createSwitchDecision(best, null, now, 'initial');
    }

    // Check if we should switch
    const current = this.scores.get(this.state.currentCam);
    if (!current) {
      // Current camera disappeared, switch
      return this.createSwitchDecision(best, this.state.currentCam, now, 'current unavailable');
    }

    // Apply switching logic
    const shouldSwitch = this.shouldSwitch(current, best, now);

    if (shouldSwitch.switch) {
      return this.createSwitchDecision(best, current.camId, now, shouldSwitch.reason);
    }

    // Hold current
    return {
      timestamp: now,
      action: 'HOLD',
      fromCam: current.camId,
      rationale: shouldSwitch.reason,
      confidence: current.score,
    };
  }

  private findBestCamera(candidates: CameraScore[], now: number): CameraScore | null {
    // Filter out cameras in cooldown
    const available = candidates.filter((cam) => {
      const cooldownUntil = this.state.cooldowns.get(cam.camId) || 0;
      return now >= cooldownUntil;
    });

    if (available.length === 0) {
      return null;
    }

    // Find highest score
    return available.reduce((best, cam) =>
      cam.score > best.score ? cam : best
    );
  }

  private shouldSwitch(
    current: CameraScore,
    best: CameraScore,
    now: number
  ): { switch: boolean; reason: string } {
    // Same camera
    if (current.camId === best.camId) {
      return { switch: false, reason: 'same camera' };
    }

    // Check min hold time (hysteresis)
    if (this.policy.enableHysteresis) {
      const timeSinceSwitch = now - this.state.lastSwitchTime;
      if (timeSinceSwitch < this.policy.minHoldSec) {
        return {
          switch: false,
          reason: `min hold not met (${timeSinceSwitch.toFixed(1)}s < ${this.policy.minHoldSec}s)`,
        };
      }
    }

    // Check score delta threshold
    const deltaS = best.score - current.score;
    if (deltaS < this.policy.deltaSThreshold) {
      return {
        switch: false,
        reason: `delta too small (ΔS=${deltaS.toFixed(3)} < ${this.policy.deltaSThreshold})`,
      };
    }

    // Check max shot duration (force switch if too long)
    const shotDuration = now - this.state.lastSwitchTime;
    if (shotDuration > this.policy.maxShotDurationSec) {
      return {
        switch: true,
        reason: `max duration exceeded (${shotDuration.toFixed(1)}s)`,
      };
    }

    // Check for ping-pong pattern
    if (this.detectPingPong(best.camId)) {
      return {
        switch: false,
        reason: 'ping-pong pattern detected',
      };
    }

    // All checks passed
    return {
      switch: true,
      reason: `ΔS=${deltaS.toFixed(3)}, ${best.reason}`,
    };
  }

  private createSwitchDecision(
    best: CameraScore,
    fromCam: string | null,
    now: number,
    rationale: string
  ): SwitchDecision {
    // Update state
    if (fromCam && this.policy.enableCooldown) {
      this.state.cooldowns.set(fromCam, now + this.policy.cooldownSec);
    }

    this.state.currentCam = best.camId;
    this.state.lastSwitchTime = now;
    this.state.switchHistory.push({ cam: best.camId, time: now });

    // Keep history limited
    if (this.state.switchHistory.length > 10) {
      this.state.switchHistory.shift();
    }

    this.logger.info({
      action: 'SWITCH',
      from: fromCam,
      to: best.camId,
      score: best.score,
      rationale,
    });

    return {
      timestamp: now,
      action: 'SWITCH',
      toCam: best.camId,
      fromCam: fromCam || undefined,
      holdSec: this.policy.minHoldSec,
      rationale,
      deltaScore: fromCam ? best.score - (this.scores.get(fromCam)?.score || 0) : best.score,
      confidence: best.score,
    };
  }

  private detectPingPong(targetCam: string): boolean {
    // Check if we're switching back to a recent camera too quickly
    const recentSwitches = this.state.switchHistory.slice(-5);

    if (recentSwitches.length < 3) {
      return false;
    }

    // Count how many times we've switched to this camera recently
    const recentCount = recentSwitches.filter((s) => s.cam === targetCam).length;

    return recentCount >= 2;
  }

  getCurrentCamera(): string | null {
    return this.state.currentCam;
  }

  getState(): SwitchState {
    return { ...this.state };
  }

  reset(): void {
    this.state.currentCam = null;
    this.state.lastSwitchTime = 0;
    this.state.switchHistory = [];
    this.state.cooldowns.clear();
    this.scores.clear();
  }
}
