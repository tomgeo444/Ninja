/**
 * SLICE IT: Ninja Mode - Synthesized Web Audio Engine
 * Zero audio assets: 100% procedurally synthesized sound effects
 * using the Web Audio API with realistic dynamic variation, pitch scaling,
 * filter sweeps, and musical arpeggios.
 */

(function (window) {
  'use strict';

  class NinjaAudio {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.isMuted = false;
      this.volume = 0.7; // Default 70%
      this.noiseBuffer = null;
      this.lastSwooshTime = 0;
      this.initialized = false;
    }

    /**
     * Initializes AudioContext upon user gesture.
     */
    init() {
      if (this.initialized && this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }

      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('[SliceIt] Web Audio API not supported on this browser.');
        return;
      }

      try {
        this.ctx = new AudioCtxClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Pre-generate 1-second white noise buffer for swooshes & slice transients
        const bufferSize = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        this.initialized = true;
      } catch (err) {
        console.warn('[SliceIt] Could not start AudioContext:', err);
      }
    }

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      if (this.masterGain && this.ctx) {
        const target = this.isMuted ? 0 : this.volume;
        this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
      }
    }

    setMuted(muted) {
      this.isMuted = !!muted;
      if (this.masterGain && this.ctx) {
        const target = this.isMuted ? 0 : this.volume;
        this.masterGain.gain.setValueAtTime(target, this.ctx.currentTime);
      }
    }

    /**
     * Blade Swoosh: Bandpass filtered noise swept upward, volume & pitch tied to speed.
     */
    playSwoosh(speed = 600) {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;
      // Throttle swoosh to avoid overwhelming audio
      if (now - this.lastSwooshTime < 0.1) return;
      this.lastSwooshTime = now;

      try {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 2.5;

        // Freq tied to speed (normalized 400..3000)
        const normSpeed = Math.min(1, Math.max(0, (speed - 300) / 2000));
        const startFreq = 500 + normSpeed * 400;
        const endFreq = 1400 + normSpeed * 1000;

        filter.frequency.setValueAtTime(startFreq, now);
        filter.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

        const gain = this.ctx.createGain();
        const swooshVol = (0.2 + normSpeed * 0.3) * 0.6;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(swooshVol, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.13);
      } catch (e) {}
    }

    /**
     * Slice Sound: Layered noise transient burst + descending sine/triangle sweep.
     * Escalates pitch with combo level.
     */
    playSlice(combo = 1) {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        // Random detune between -5% and +5%
        const detuneFactor = 1 + (Math.random() * 0.1 - 0.05);
        // Base frequency scales with combo
        const comboMultiplier = Math.min(2.5, Math.pow(1.08, combo - 1));

        // Layer 1: High transient "sching" noise
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(2500 * detuneFactor, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.06);

        // Layer 2: Descending tonal blade whoosh
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        const startPitch = 850 * comboMultiplier * detuneFactor;
        const endPitch = 220 * detuneFactor;

        osc.frequency.setValueAtTime(startPitch, now);
        osc.frequency.exponentialRampToValueAtTime(endPitch, now + 0.07);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.45, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(oscGain);
        oscGain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.1);

        // Layer 3: Subtle sub thump for body
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(110, now);
        sub.frequency.exponentialRampToValueAtTime(45, now + 0.05);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.3, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        sub.connect(subGain);
        subGain.connect(this.masterGain);

        sub.start(now);
        sub.stop(now + 0.07);
      } catch (e) {}
    }

    /**
     * Tough Crack: Sharp snap with metallic ring when large element is cracked.
     */
    playCrack() {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.Q.value = 5.0;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.11);
      } catch (e) {}
    }

    /**
     * Critical Slice ("PERFECT!"): Bright crystalline chime chord (E6 + B6).
     */
    playPerfect() {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        const freqs = [1318.5, 1975.5, 2637.0]; // E6, B6, E7
        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.02);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.001, now + idx * 0.02);
          gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.02 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.02 + 0.45);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(now + idx * 0.02);
          osc.stop(now + idx * 0.02 + 0.46);
        });
      } catch (e) {}
    }

    /**
     * Combo Callout Fanfare: Rising musical arpeggio based on combo size.
     */
    playCombo(count) {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        // Pentatonic / major uplifting notes
        let notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        if (count >= 4) notes = [659.25, 783.99, 1046.5]; // E5, G5, C6
        if (count >= 5) notes = [783.99, 1046.5, 1318.5, 1567.98]; // G5, C6, E6, G6

        notes.forEach((freq, i) => {
          const noteTime = now + i * 0.06;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteTime);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.001, noteTime);
          gain.gain.linearRampToValueAtTime(0.4, noteTime + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(noteTime);
          osc.stop(noteTime + 0.3);
        });
      } catch (e) {}
    }

    /**
     * Bomb Explosion: Low boom, rumbling sub-bass and distorted noise blast.
     */
    playBombExplosion() {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        // Sub drop
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(160, now);
        sub.frequency.exponentialRampToValueAtTime(28, now + 0.5);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.8, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        sub.connect(subGain);
        subGain.connect(this.masterGain);

        sub.start(now);
        sub.stop(now + 0.75);

        // Low-pass noise rumble
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.6);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.7, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noise.start(now);
        noise.stop(now + 0.7);
      } catch (e) {}
    }

    /**
     * Fever Activation: Glorious multi-voice rising synth chord.
     */
    playFeverStart() {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        const chord = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
        chord.forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq * 0.7, now);
          osc.frequency.exponentialRampToValueAtTime(freq, now + 0.35);

          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.exponentialRampToValueAtTime(3500, now + 0.4);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.masterGain);

          osc.start(now);
          osc.stop(now + 0.85);
        });
      } catch (e) {}
    }

    /**
     * Game Over Sting: Melancholic descending minor chord.
     */
    playGameOver() {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        const notes = [440, 392, 349.23, 293.66]; // A4, G4, F4, D4
        notes.forEach((freq, idx) => {
          const time = now + idx * 0.16;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, time);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(0.001, time);
          gain.gain.linearRampToValueAtTime(0.4, time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

          osc.connect(gain);
          gain.connect(this.masterGain);

          osc.start(time);
          osc.stop(time + 0.65);
        });
      } catch (e) {}
    }

    /**
     * Countdown beep for 3, 2, 1, GO!
     */
    playCountdownTick(isGo = false) {
      if (!this.initialized || !this.ctx || this.isMuted) return;
      const now = this.ctx.currentTime;

      try {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        const freq = isGo ? 1480 : 740;
        osc.frequency.setValueAtTime(freq, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.35 : 0.15));

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + (isGo ? 0.36 : 0.16));
      } catch (e) {}
    }
  }

  window.NinjaAudio = new NinjaAudio();
})(window);
