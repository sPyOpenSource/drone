/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class DroneAudioEngine {
  private ctx: AudioContext | null = null;
  private mainGain: GainNode | null = null;
  private motorGains: GainNode[] = [];
  private motorOscs: OscillatorNode[] = [];
  private windGain: GainNode | null = null;
  private windOsc: AudioBufferSourceNode | null = null;
  private initialized = false;
  private muted = false;
  private volumeLevel = 0.5;

  // Alarms
  private alarmOsc: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private alarmInterval: any = null;
  private isAlarmPlaying = false;

  constructor() {
    // Lazy initialize on user interaction
  }

  init() {
    if (this.initialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(this.volumeLevel, this.ctx.currentTime);
      this.mainGain.connect(this.ctx.destination);

      // Create synthetic motors (one primary oscillator per rotor, 4 rotors total)
      const baseFreqs = [120, 122, 119, 121]; // Slightly detuned for realism
      for (let i = 0; i < 4; i++) {
        // Core hum oscillator
        const osc = this.ctx.createOscillator();
        const rotorGain = this.ctx.createGain();

        // Sawtooth gives that buzzy rotor aesthetic
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreqs[i], this.ctx.currentTime);

        // Sub-harmonic oscillator for deep vibration
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(baseFreqs[i] * 0.5, this.ctx.currentTime);

        // Low pass filter to make it sound like it's muffled FPV frame housing
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(rotorGain);

        rotorGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
        rotorGain.connect(this.mainGain);

        osc.start();
        subOsc.start();

        this.motorOscs.push(osc);
        this.motorOscs.push(subOsc); // Save to shut down later
        this.motorGains.push(rotorGain);
      }

      // White/Pink noise to simulate high-frequency wind rushing / blade vortex shedding
      this.createWindNoise();

      this.initialized = true;
    } catch (e) {
      console.error('Failed to initialize sound engine:', e);
    }
  }

  private createWindNoise() {
    if (!this.ctx || !this.mainGain) return;

    try {
      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Simple white noise algorithm
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // Filter for air rush sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.02, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(this.windGain);
      this.windGain.connect(this.mainGain);

      noiseSource.start();
      this.windOsc = noiseSource;
    } catch (e) {
      console.error('Failed to create wind noise:', e);
    }
  }

  update(throttle: number, motorOutputs: [number, number, number, number], speed: number) {
    if (!this.initialized || this.muted || !this.ctx) return;

    try {
      const time = this.ctx.currentTime;

      // Base throttle sets motor sound speeds
      for (let i = 0; i < 4; i++) {
        const motorPower = motorOutputs[i]; // 0 to 1

        // Motor primary osc (index i * 2)
        const primaryOsc = this.motorOscs[i * 2];
        const subOsc = this.motorOscs[i * 2 + 1];
        const gainNode = this.motorGains[i];

        if (primaryOsc && subOsc && gainNode) {
          // Map power to pitch (from ~120Hz at zero throttle to ~480Hz at full throttle)
          const targetFreq = 110 + motorPower * 350;
          primaryOsc.frequency.setTargetAtTime(targetFreq, time, 0.08);
          subOsc.frequency.setTargetAtTime(targetFreq * 0.5, time, 0.08);

          // Map power to rotor gain
          // Make sure there is always a tiny, warm idle hum at 0 throttle
          const targetGain = 0.015 + motorPower * 0.045;
          gainNode.gain.setTargetAtTime(targetGain, time, 0.05);
        }
      }

      // Modulate wind volume based on flight speed to sound like air rushing past frame
      if (this.windGain) {
        const windTarget = Math.min(0.08, speed * 0.001);
        this.windGain.gain.setTargetAtTime(windTarget, time, 0.15);
      }
    } catch (e) {
      // Audio error safety fallback
    }
  }

  playGatePass() {
    if (!this.initialized || this.muted || !this.ctx || !this.mainGain) return;

    try {
      const time = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Fun upbeat double chime (swooping harmony)
      osc1.frequency.setValueAtTime(523.25, time); // C5
      osc1.frequency.exponentialRampToValueAtTime(880, time + 0.15); // A5

      osc2.frequency.setValueAtTime(659.25, time); // E5
      osc2.frequency.exponentialRampToValueAtTime(1046.5, time + 0.15); // C6

      gain.gain.setValueAtTime(0.12, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.mainGain);

      osc1.start();
      osc2.start();

      osc1.stop(time + 0.4);
      osc2.stop(time + 0.4);
    } catch (e) {
      // Ignored
    }
  }

  playWinchAttach() {
    if (!this.initialized || this.muted || !this.ctx || !this.mainGain) return;

    try {
      const time = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.setValueAtTime(300, time + 0.05);

      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      osc.connect(gain);
      gain.connect(this.mainGain);

      osc.start();
      osc.stop(time + 0.2);
    } catch (e) {
      // Ignored
    }
  }

  playCrash() {
    if (!this.initialized || this.muted || !this.ctx || !this.mainGain) return;

    try {
      const time = this.ctx.currentTime;

      // Low bass rumble
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, time);
      osc.frequency.linearRampToValueAtTime(20, time + 0.5);

      // Noise burst for debris
      const noiseSize = this.ctx.sampleRate * 0.5;
      const noiseBuffer = this.ctx.createBuffer(1, noiseSize, this.ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(250, time);
      noiseFilter.frequency.exponentialRampToValueAtTime(50, time + 0.5);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.mainGain);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);

      osc.connect(gain);
      gain.connect(this.mainGain);

      osc.start();
      noise.start();

      osc.stop(time + 0.8);
      noise.stop(time + 0.8);
    } catch (e) {
      // Ignored
    }
  }

  setMute(mute: boolean) {
    this.muted = mute;
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setValueAtTime(mute ? 0 : this.volumeLevel, this.ctx.currentTime);
    }
  }

  setVolume(volume: number) {
    this.volumeLevel = Math.max(0, Math.min(1, volume));
    if (this.mainGain && this.ctx && !this.muted) {
      this.mainGain.gain.setTargetAtTime(this.volumeLevel, this.ctx.currentTime, 0.05);
    }
  }

  toggleBatteryBeep(play: boolean) {
    if (!this.initialized || this.muted || !this.ctx || !this.mainGain) return;

    if (play && !this.isAlarmPlaying) {
      this.isAlarmPlaying = true;
      this.alarmInterval = setInterval(() => {
        if (!this.ctx || !this.mainGain || this.muted) return;
        try {
          const time = this.ctx.currentTime;
          const osc1 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(880, time); // A5

          gain.gain.setValueAtTime(0.1, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

          osc1.connect(gain);
          gain.connect(this.mainGain);

          osc1.start();
          osc1.stop(time + 0.2);
        } catch (e) {}
      }, 1000);
    } else if (!play && this.isAlarmPlaying) {
      this.isAlarmPlaying = false;
      if (this.alarmInterval) {
        clearInterval(this.alarmInterval);
        this.alarmInterval = null;
      }
    }
  }

  cleanup() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (e) {}
    }
    this.initialized = false;
  }
}

export const droneAudio = new DroneAudioEngine();
