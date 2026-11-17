// Emberwarden — audio.js
// All sound is synthesized with the WebAudio API: no audio files, no
// network. SoundEngine guards every call, so a browser without audio (or
// with autoplay blocked) still plays the game silently instead of erroring.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  // Browsers only allow audio after a user gesture; call this from the
  // first click or key press. Safe to call repeatedly.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // A short oscillator blip with a pitch slide.
  blip(freqFrom, freqTo, seconds, type, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freqFrom, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), now + seconds);
      gain.gain.setValueAtTime(volume || 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      osc.connect(gain).connect(this.master);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch {
      // Sound must never break the game.
    }
  }

  // Filtered noise burst, for explosions and hits.
  noise(seconds, filterFreq, volume) {
    if (!this.ctx || this.muted) return;
    try {
      const now = this.ctx.currentTime;
      const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 800;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume || 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
      source.connect(filter).connect(gain).connect(this.master);
      source.start(now);
    } catch {
      // Sound must never break the game.
    }
  }

  // Named effects the game triggers.
  shoot(kind) {
    if (kind === 'ember') this.blip(220, 70, 0.16, 'sawtooth', 0.14);
    else if (kind === 'frost') this.blip(880, 660, 0.09, 'sine', 0.07);
    else this.blip(720, 540, 0.06, 'square', 0.06);
  }

  hit() {
    this.noise(0.08, 1400, 0.08);
  }

  explode() {
    this.noise(0.28, 520, 0.22);
    this.blip(160, 40, 0.25, 'sine', 0.16);
  }

  coin() {
    this.blip(990, 990, 0.07, 'sine', 0.09);
    setTimeout(() => this.blip(1320, 1320, 0.1, 'sine', 0.09), 60);
  }

  place() {
    this.blip(330, 495, 0.12, 'triangle', 0.12);
  }

  upgrade() {
    this.blip(440, 440, 0.08, 'triangle', 0.1);
    setTimeout(() => this.blip(660, 660, 0.08, 'triangle', 0.1), 70);
    setTimeout(() => this.blip(880, 880, 0.12, 'triangle', 0.1), 140);
  }

  denied() {
    this.blip(180, 120, 0.14, 'square', 0.09);
  }

  lanternHit() {
    this.noise(0.3, 300, 0.25);
    this.blip(110, 55, 0.35, 'sawtooth', 0.18);
  }

  waveHorn() {
    this.blip(196, 196, 0.35, 'sawtooth', 0.12);
    setTimeout(() => this.blip(262, 262, 0.4, 'sawtooth', 0.12), 160);
  }

  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, freq, 0.22, 'triangle', 0.12), i * 130);
    });
  }

  defeat() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => {
      setTimeout(() => this.blip(freq, freq * 0.9, 0.3, 'sawtooth', 0.1), i * 170);
    });
  }

  // A slow ambient loop: a soft pad chord that changes every bar, plus a
  // low pulse. Kept quiet so it sits under the effects.
  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const chords = [
      [110, 165, 220, 277],
      [98, 147, 196, 247],
      [87, 131, 175, 220],
      [104, 156, 208, 262],
    ];
    const playChord = () => {
      if (!this.ctx || this.muted) {
        this.musicTimer = setTimeout(playChord, 2000);
        return;
      }
      try {
        const chord = chords[this.musicStep % chords.length];
        this.musicStep += 1;
        const now = this.ctx.currentTime;
        chord.forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(0.028, now + 0.8);
          gain.gain.linearRampToValueAtTime(0.0001, now + 3.6);
          osc.connect(gain).connect(this.master);
          osc.start(now);
          osc.stop(now + 3.8);
        });
      } catch {
        // Music must never break the game.
      }
      this.musicTimer = setTimeout(playChord, 2000);
    };
    playChord();
  }

  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicOn = false;
  }
}
