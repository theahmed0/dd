/**
 * Procedural Web Audio API Quadcopter Rotor Synthesizer (Zero External Assets).
 */
export class DroneAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private isEnabled = false;

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.ensureContext();
      if (this.ctx?.state === 'suspended') {
        void this.ctx.resume();
      }
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.15);
      }
    } else if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    }
  }

  public update(throttle: number): void {
    if (!this.isEnabled || !this.ctx || !this.filter || this.oscs.length === 0) return;

    const now = this.ctx.currentTime;
    const clamped = Math.min(Math.max(throttle, 0.2), 1.0);
    // Realistic quadcopter brushless harmonics (base 95Hz .. 230Hz)
    const baseFreq = 92 + clamped * 138;
    const ratios = [1.0, 1.022, 1.98, 2.04];

    for (let i = 0; i < this.oscs.length; i++) {
      this.oscs[i].frequency.setTargetAtTime(baseFreq * ratios[i], now, 0.08);
    }

    this.filter.frequency.setTargetAtTime(360 + clamped * 1400, now, 0.08);
    if (this.noiseGain) {
      this.noiseGain.gain.setTargetAtTime(0.08 + clamped * 0.22, now, 0.08);
    }
  }

  public dispose(): void {
    for (const osc of this.oscs) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Ignore already stopped oscillators
      }
    }
    this.oscs = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }

  private ensureContext(): void {
    if (this.ctx) return;

    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 1.4;
    filter.connect(masterGain);

    // 4 slightly detuned oscillators representing 4 brushless motors
    const oscGains = [0.22, 0.22, 0.11, 0.11];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.value = 110;
      const g = ctx.createGain();
      g.gain.value = oscGains[i];
      osc.connect(g);
      g.connect(filter);
      osc.start();
      this.oscs.push(osc);
    }

    // Procedural propeller airwash noise buffer
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 340;
    bandpass.Q.value = 0.7;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.12;

    whiteNoise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(filter);
    whiteNoise.start();

    this.ctx = ctx;
    this.masterGain = masterGain;
    this.filter = filter;
    this.noiseGain = noiseGain;
  }
}
