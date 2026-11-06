/**
 * Comprehensive Procedural Soundscape, Multi-State Adaptive Music Synthesizer,
 * Tactile UI Feedback & Biological Combat SFX Engine using the native Web Audio API.
 * Zero external .mp3/.wav asset dependencies (100% immune to 404/network latency).
 */
export type AdaptiveMusicState =
  | 'menu'
  | 'ocean'
  | 'combat'
  | 'editor'
  | 'none';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private masterVolume = 0.8;
  private sfxVolume = 0.85;
  private ambientVolume = 0.7;
  private threatAudioAlerts = true;

  // Cooldown timestamps (performance.now() in ms) to prevent overlapping audio spam
  private lastHoverAt = 0;
  private lastClickAt = 0;
  private lastKeyTypeAt = 0;
  private lastFoodAt = 0;
  private lastBiteAt = 0;
  private lastBoostAt = 0;
  private lastThreatAt = 0;
  private lastDamageAt = 0;
  private lastShieldAt = 0;
  private lastReentryPulseAt = 0;

  // Polyphonic Adaptive Music State & Scheduler
  private currentMusicState: AdaptiveMusicState = 'none';
  private musicSchedulerId: number | null = null;
  private musicStepIndex = 0;
  private peacefulBusGain: GainNode | null = null;
  private combatBusGain: GainNode | null = null;
  private combatTailUntilTime = 0;
  private oceanCurrentSource: AudioBufferSourceNode | null = null;
  private oceanCurrentFilter: BiquadFilterNode | null = null;
  private oceanCurrentGain: GainNode | null = null;
  private bubblingBusGain: GainNode | null = null;
  private bubblingSpawnAccumulator = 0;
  private currentDepthNorm = 0.2;
  private currentActivityNorm = 0.0;
  private currentBubblingVolume = 0;
  private currentCurrentsVolume = 0;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;
  private softClipCurve: Float32Array<ArrayBuffer> | null = null;

  // Active Cinematic Loops (for clean stop if user skips intro with [Space])
  private activeCinematicNodes: Array<{
    stop: () => void;
    gain?: GainNode;
  }> = [];

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.peacefulBusGain = this.ctx.createGain();
        this.combatBusGain = this.ctx.createGain();
        this.bubblingBusGain = this.ctx.createGain();

        this.peacefulBusGain.gain.value = 1.0;
        this.combatBusGain.gain.value = 0.0001;
        this.bubblingBusGain.gain.value = 0.0001;

        this.peacefulBusGain.connect(this.musicGain);
        this.combatBusGain.connect(this.musicGain);
        this.bubblingBusGain.connect(this.musicGain);
        this.sfxGain.connect(this.ctx.destination);
        this.musicGain.connect(this.ctx.destination);
        this.updateGainNodesImmediate();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignore autoplay restriction until user gesture
      });
    }
    return this.ctx;
  }

  private getSfxDestination(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.sfxGain ?? ctx.destination;
  }

  private getMusicDestination(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.peacefulBusGain ?? this.musicGain ?? ctx.destination;
  }

  private getCombatMusicDestination(): AudioNode | null {
    const ctx = this.getContext();
    if (!ctx) return null;
    return this.combatBusGain ?? this.musicGain ?? ctx.destination;
  }

  public unlock(): void {
    const ctx = this.getContext();
    if (ctx && this.currentMusicState !== 'none' && !this.musicSchedulerId) {
      this.startMusicScheduler();
    }
  }

  public syncSettings(
    masterVolumePercent: number,
    sfxVolumePercent: number,
    threatAudioAlerts: boolean,
    ambientVolumePercent = 70
  ): void {
    this.masterVolume = Math.max(0, Math.min(1, masterVolumePercent / 100));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolumePercent / 100));
    this.ambientVolume = Math.max(0, Math.min(1, ambientVolumePercent / 100));
    this.threatAudioAlerts = threatAudioAlerts;
    this.updateGainNodesImmediate();
  }

  private updateGainNodesImmediate(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const sfxVol = this.masterVolume * this.sfxVolume;
    const musVol = this.masterVolume * this.ambientVolume;
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(sfxVol, now, 0.03);
    }
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(musVol, now, 0.08);
    }
  }

  private getEffectiveSfxVolume(): number {
    return this.masterVolume * this.sfxVolume;
  }

  private getEffectiveMusicVolume(): number {
    return this.masterVolume * this.ambientVolume;
  }

  private getSoftClipCurve(): Float32Array<ArrayBuffer> {
    if (this.softClipCurve) return this.softClipCurve;
    const samples = 1024;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * 2.4);
    }
    this.softClipCurve = curve;
    return curve;
  }

  private getWhiteNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.whiteNoiseBuffer && this.whiteNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.whiteNoiseBuffer;
    }
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.whiteNoiseBuffer = buffer;
    return buffer;
  }

  private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.pinkNoiseBuffer && this.pinkNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.pinkNoiseBuffer;
    }
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
    this.pinkNoiseBuffer = buffer;
    return buffer;
  }

  private getBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.brownNoiseBuffer && this.brownNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.brownNoiseBuffer;
    }
    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.025 * white) / 1.025;
      lastOut = data[i];
      data[i] *= 3.2;
    }
    this.brownNoiseBuffer = buffer;
    return buffer;
  }

  // ============================================================================
  // 1. TACTILE UI & KEYBOARD FEEDBACK (HOVER vs. CLICK vs. KEYSTROKE)
  // ============================================================================

  /**
   * Subtle, crisp high-pitched organic membrane/key tick when hovering over interactive UI elements.
   */
  public playButtonHover(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastHoverAt < 38) return;
    this.lastHoverAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, t);
    osc.frequency.exponentialRampToValueAtTime(1640, t + 0.024);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.value = 2.5;

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.055, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.028);
  }

  /**
   * Percussive, defined mechanical-aquatic confirmation click when pressing a button or selecting an option.
   */
  public playButtonClick(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastClickAt < 35) return;
    this.lastClickAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // Layer 1: Warm resonant droplet body
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(520, t);
    osc1.frequency.exponentialRampToValueAtTime(980, t + 0.045);
    osc1.frequency.exponentialRampToValueAtTime(640, t + 0.075);

    gain1.gain.setValueAtTime(0.001, t);
    gain1.gain.linearRampToValueAtTime(0.16, t + 0.006);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

    osc1.connect(gain1);
    gain1.connect(dest);

    // Layer 2: Crisp tactile transient snap
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1850, t);
    osc2.frequency.exponentialRampToValueAtTime(760, t + 0.028);

    gain2.gain.setValueAtTime(0.11, t);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    osc2.connect(gain2);
    gain2.connect(dest);

    osc1.onended = () => {
      osc1.disconnect();
      gain1.disconnect();
    };
    osc2.onended = () => {
      osc2.disconnect();
      gain2.disconnect();
    };

    osc1.start(t);
    osc1.stop(t + 0.085);
    osc2.start(t);
    osc2.stop(t + 0.032);
  }

  /**
   * Organic soft keystroke click when typing a species name in Genesis or the 3D Editor.
   */
  public playKeyType(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastKeyTypeAt < 25) return;
    this.lastKeyTypeAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const pitchJitter = 0.94 + Math.random() * 0.12;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(820 * pitchJitter, t);
    osc.frequency.exponentialRampToValueAtTime(410 * pitchJitter, t + 0.032);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.09, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);

    osc.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.038);
  }

  // ============================================================================
  // 2. BIOLOGICAL GAMEPLAY, COMBAT & ABILITY SFX
  // ============================================================================

  /**
   * Organic suction + crystalline chord when equipping an organ in the 3D Workshop.
   */
  public playEvolutionEquip(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // Suction pop
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(240, t);
    popOsc.frequency.exponentialRampToValueAtTime(680, t + 0.065);
    popGain.gain.setValueAtTime(0.18, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    popOsc.connect(popGain);
    popGain.connect(dest);
    popOsc.onended = () => {
      popOsc.disconnect();
      popGain.disconnect();
    };
    popOsc.start(t);
    popOsc.stop(t + 0.08);

    // Ascending harmonic triad
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + 0.03 + idx * 0.042;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);

      osc.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  /**
   * Descending organic pop when removing/refunding a placed organ.
   */
  public playEvolutionRemove(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(590, t);
    osc.frequency.exponentialRampToValueAtTime(210, t + 0.14);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.16);
  }

  /**
   * Crunchy organic mastication / bite sound when devouring meat, plants, or biting enemy cells.
   */
  public playBiteCrunch(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBiteAt < 75) return;
    this.lastBiteAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // 1. Jaw snap low-mid sawtooth sweep
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(82, t + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1350, t);
    filter.frequency.exponentialRampToValueAtTime(260, t + 0.12);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    osc.start(t);
    osc.stop(t + 0.14);

    // 2. Chitinous crunch noise burst
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getWhiteNoiseBuffer(ctx);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(980, t);
    noiseFilter.Q.value = 1.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.095);

    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    noiseSrc.onended = () => {
      noiseSrc.disconnect();
      noiseFilter.disconnect();
      noiseGain.disconnect();
    };
    noiseSrc.start(t);
    noiseSrc.stop(t + 0.1);
  }

  /**
   * Nutrient/DNA ingestion sound with organic mastication crunch.
   */
  public playFoodEaten(
    kind: 'plant' | 'meat' | 'dna_spore' | 'genetic_nodule' = 'plant'
  ): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastFoodAt < 45) return;
    this.lastFoodAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    if (kind === 'meat') {
      this.playBiteCrunch();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq =
      kind === 'genetic_nodule'
        ? 680
        : kind === 'dna_spore'
        ? 590
        : kind === 'meat'
        ? 360
        : 480;

    osc.type = kind === 'meat' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.68, t + 0.095);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.17, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.13);
  }

  /**
   * Bite / melee attack impact sound.
   */
  public playBiteAttack(): void {
    this.playBiteCrunch();
  }

  /**
   * Chitinous/metallic shield deflection sound when armor, shield plates, or mucus absorb incoming damage,
   * or attenuated impact sound when colliding at high speed with solid environment obstacles.
   */
  public playShieldDeflect(attenuation = 1.0): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastShieldAt < 110) return;
    this.lastShieldAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const scale = Math.max(0.15, Math.min(1.0, attenuation));
    const pitchScale = 0.65 + 0.35 * scale;
    const t = ctx.currentTime;

    // Resonant chitinous ricochet ping (attenuated and lower-pitched for rock/trunk impacts)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(640 * pitchScale, t);
    osc1.frequency.exponentialRampToValueAtTime(1120 * pitchScale, t + 0.045);
    osc1.frequency.exponentialRampToValueAtTime(480 * pitchScale, t + 0.18);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1480 * pitchScale, t);
    osc2.frequency.exponentialRampToValueAtTime(920 * pitchScale, t + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1050 * pitchScale, t);
    filter.Q.value = 4.2;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24 * scale, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.onended = () => {
      osc1.disconnect();
      osc2.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.2);
    osc2.stop(t + 0.2);
  }

  /**
   * Sibilant toxic gas hiss when releasing a poison cloud (`poison_gland` / `weapon_caustic_acid_blister`).
   */
  public playPoisonHiss(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1850, t);
    filter.frequency.exponentialRampToValueAtTime(620, t + 0.34);
    filter.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    src.start(t);
    src.stop(t + 0.36);
  }

  /**
   * High-voltage bioelectric arc crackle (`electric_cell` / `weapon_flash_photophore`).
   */
  public playElectricZap(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    const carrier = ctx.createOscillator();
    const modOsc = ctx.createOscillator();
    const modGain = ctx.createGain();
    const outGain = ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(420, t);
    carrier.frequency.exponentialRampToValueAtTime(160, t + 0.26);

    modOsc.type = 'square';
    modOsc.frequency.setValueAtTime(48, t);
    modGain.gain.setValueAtTime(340, t);

    outGain.gain.setValueAtTime(0.001, t);
    outGain.gain.linearRampToValueAtTime(0.25, t + 0.01);
    outGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.27);

    modOsc.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(outGain);
    outGain.connect(dest);

    carrier.onended = () => {
      modOsc.disconnect();
      modGain.disconnect();
      carrier.disconnect();
      outGain.disconnect();
    };

    modOsc.start(t);
    carrier.start(t);
    modOsc.stop(t + 0.28);
    carrier.stop(t + 0.28);
  }

  /**
   * Pressurized caustic liquid splash when firing `acid_spit`.
   */
  public playAcidSplash(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(580, t);
    osc.frequency.exponentialRampToValueAtTime(190, t + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.16);
    filter.Q.value = 5.0;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.19);
  }

  /**
   * Deep low-frequency growl/pulse when a predator stalks or lunges at the player.
   */
  public playThreatRoar(): void {
    if (!this.threatAudioAlerts) return;
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastThreatAt < 2600) return;
    this.lastThreatAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125, t);
    osc.frequency.linearRampToValueAtTime(88, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(54, t + 0.42);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(62, t);
    subOsc.frequency.exponentialRampToValueAtTime(38, t + 0.42);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, t);
    filter.Q.value = 3.2;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      subOsc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + 0.46);
    subOsc.stop(t + 0.46);
  }

  /**
   * Alias for threat radar / predator alert compatibility.
   */
  public playThreatAlert(): void {
    this.playThreatRoar();
  }

  /**
   * Blunt organic thud when the player takes unshielded damage.
   */
  public playDamageTaken(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastDamageAt < 110) return;
    this.lastDamageAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.19);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);

    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Hydrodynamic water impulse whoosh when boosting with [Space].
   */
  public playBoostThrust(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBoostAt < 320) return;
    this.lastBoostAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = this.getPinkNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(240, t);
    filter.frequency.exponentialRampToValueAtTime(760, t + 0.11);
    filter.frequency.exponentialRampToValueAtTime(190, t + 0.25);
    filter.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noiseSource.onended = () => {
      noiseSource.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    noiseSource.start(t);
    noiseSource.stop(t + 0.27);
  }

  /**
   * Crystalline discovery fanfare when cracking an abyssal fossil meteorite or isolating a new gene.
   */
  public playMeteorDiscovery(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + i * 0.065;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);

      osc.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };

      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  /**
   * Spore Brain Evolution Sequence (5.5s 3-Layer Modular Web Audio Synthesis):
   * - Layer 1 (Sub-Aquatic Mystic Drone): Low sine/triangle oscillator (55 Hz -> 110 Hz) filtered to build organic tension.
   * - Layer 2 (Neural Synaptic Impulses): Short bursts of bandpass-filtered noise and stochastic micro-tones whose cadence accelerates with progress p.
   * - Layer 3 (Final Absorption Resonance): Ascending perfect-fifth lowpass filter sweep with a sub-bass impact and warm harmonic decay upon cranial fusion.
   */
  public playBrainEvolutionSequence(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const seqDuration = 5.5;

    // =========================================================================
    // LAYER 1: Sub-Aquatic Mystic Drone (55 Hz -> 110 Hz filtered sine/triangle)
    // =========================================================================
    const droneSub = ctx.createOscillator();
    const droneHarm = ctx.createOscillator();
    const droneFilter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();

    droneSub.type = 'sine';
    droneSub.frequency.setValueAtTime(55.0, t);
    droneSub.frequency.exponentialRampToValueAtTime(82.41, t + 3.6);
    droneSub.frequency.exponentialRampToValueAtTime(110.0, t + 4.75);

    droneHarm.type = 'triangle';
    droneHarm.frequency.setValueAtTime(55.3, t);
    droneHarm.frequency.exponentialRampToValueAtTime(110.6, t + 4.75);

    droneFilter.type = 'lowpass';
    droneFilter.Q.setValueAtTime(4.2, t);
    droneFilter.frequency.setValueAtTime(140, t);
    droneFilter.frequency.exponentialRampToValueAtTime(520, t + 3.6);
    droneFilter.frequency.exponentialRampToValueAtTime(980, t + 4.65);
    droneFilter.frequency.exponentialRampToValueAtTime(180, t + seqDuration);

    droneGain.gain.setValueAtTime(0.0001, t);
    droneGain.gain.linearRampToValueAtTime(0.24, t + 0.55);
    droneGain.gain.linearRampToValueAtTime(0.32, t + 3.8);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, t + seqDuration);

    droneSub.connect(droneFilter);
    droneHarm.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(dest);

    droneSub.onended = () => {
      droneSub.disconnect();
      droneHarm.disconnect();
      droneFilter.disconnect();
      droneGain.disconnect();
    };
    droneSub.start(t);
    droneHarm.start(t);
    droneSub.stop(t + seqDuration + 0.05);
    droneHarm.stop(t + seqDuration + 0.05);

    // =========================================================================
    // LAYER 2: Accelerating Neural Synapses (Bandpass Noise Bursts & Micro-Tones)
    // =========================================================================
    const pinkBuffer = this.getPinkNoiseBuffer(ctx);
    const pentatonicScale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

    let cursor = 0.08;
    let pulseIdx = 0;
    while (cursor < 4.62) {
      const pNorm = cursor / 4.62;
      const fireTime = t + cursor;

      // 2A. Bandpass-filtered synaptic noise burst
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = pinkBuffer;
      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.Q.setValueAtTime(6.5 + pNorm * 5.0, fireTime);
      const centerFreq = 900 + pNorm * 2200 + ((pulseIdx * 317) % 600);
      bpFilter.frequency.setValueAtTime(centerFreq, fireTime);
      bpFilter.frequency.exponentialRampToValueAtTime(
        centerFreq * 1.35,
        fireTime + 0.065
      );

      const burstGain = ctx.createGain();
      const burstPeak = 0.06 + pNorm * 0.08;
      burstGain.gain.setValueAtTime(0.0001, fireTime);
      burstGain.gain.linearRampToValueAtTime(burstPeak, fireTime + 0.008);
      burstGain.gain.exponentialRampToValueAtTime(0.0001, fireTime + 0.075);

      noiseSrc.connect(bpFilter);
      bpFilter.connect(burstGain);
      burstGain.connect(dest);
      noiseSrc.onended = () => {
        noiseSrc.disconnect();
        bpFilter.disconnect();
        burstGain.disconnect();
      };
      noiseSrc.start(fireTime, (pulseIdx * 0.13) % 1.8, 0.085);

      // 2B. Bioluminescent stochastic micro-tone
      const toneOsc = ctx.createOscillator();
      const toneGain = ctx.createGain();
      toneOsc.type = pulseIdx % 2 === 0 ? 'sine' : 'triangle';
      const noteFreq =
        pentatonicScale[(pulseIdx + Math.floor(pNorm * 4)) % pentatonicScale.length] *
        (pNorm > 0.65 ? 1.5 : 1.0);
      toneOsc.frequency.setValueAtTime(noteFreq, fireTime);
      toneOsc.frequency.exponentialRampToValueAtTime(
        noteFreq * 1.12,
        fireTime + 0.09
      );

      const tonePeak = 0.045 + pNorm * 0.055;
      toneGain.gain.setValueAtTime(0.0001, fireTime);
      toneGain.gain.linearRampToValueAtTime(tonePeak, fireTime + 0.012);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, fireTime + 0.11);

      toneOsc.connect(toneGain);
      toneGain.connect(dest);
      toneOsc.onended = () => {
        toneOsc.disconnect();
        toneGain.disconnect();
      };
      toneOsc.start(fireTime);
      toneOsc.stop(fireTime + 0.12);

      // Cadence accelerates progressively as p advances (from 0.36s down to 0.065s in Phase 3)
      const stepDelta = Math.max(0.065, 0.36 * Math.pow(1.0 - pNorm * 0.82, 1.45));
      cursor += stepDelta;
      pulseIdx++;
    }

    // =========================================================================
    // LAYER 3: Final Cranial Absorption Resonance (t + 4.65s -> t + 5.55s)
    // Perfect-fifth harmonic sweep + sub-bass cranial impact + warm decay
    // =========================================================================
    const absorbTime = t + 4.65;

    // 3A. Deep Sub-Bass Cranial Fusion Impact
    const subImpactOsc = ctx.createOscillator();
    const subImpactGain = ctx.createGain();
    subImpactOsc.type = 'sine';
    subImpactOsc.frequency.setValueAtTime(135.0, absorbTime);
    subImpactOsc.frequency.exponentialRampToValueAtTime(42.0, absorbTime + 0.55);

    subImpactGain.gain.setValueAtTime(0.0001, absorbTime);
    subImpactGain.gain.linearRampToValueAtTime(0.38, absorbTime + 0.025);
    subImpactGain.gain.exponentialRampToValueAtTime(0.0001, absorbTime + 0.85);

    subImpactOsc.connect(subImpactGain);
    subImpactGain.connect(dest);
    subImpactOsc.onended = () => {
      subImpactOsc.disconnect();
      subImpactGain.disconnect();
    };
    subImpactOsc.start(absorbTime);
    subImpactOsc.stop(absorbTime + 0.9);

    // 3B. Ascending Perfect-Fifth Harmonic Chord with Lowpass Filter Sweep
    const fifthChordFreqs = [110.0, 164.81, 220.0, 329.63, 440.0, 659.25];
    fifthChordFreqs.forEach((baseF, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = idx < 2 ? 'sawtooth' : 'triangle';
      // Sweep up a perfect fifth (1.5x ratio) during assimilation
      osc.frequency.setValueAtTime(baseF, absorbTime - 0.15);
      osc.frequency.exponentialRampToValueAtTime(
        baseF * 1.5,
        absorbTime + 0.22
      );

      filter.type = 'lowpass';
      filter.Q.setValueAtTime(2.8, absorbTime - 0.15);
      filter.frequency.setValueAtTime(320, absorbTime - 0.15);
      filter.frequency.exponentialRampToValueAtTime(3800, absorbTime + 0.25);
      filter.frequency.exponentialRampToValueAtTime(720, absorbTime + 1.15);

      const amp = idx < 2 ? 0.1 : 0.075;
      gain.gain.setValueAtTime(0.0001, absorbTime - 0.15);
      gain.gain.linearRampToValueAtTime(amp, absorbTime + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, absorbTime + 1.15);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      osc.start(absorbTime - 0.15);
      osc.stop(absorbTime + 1.2);
    });
  }

  /**
   * Descending cellular collapse when an organism dies.
   */
  public playCreatureDeath(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(44, t + 0.38);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, t);
    filter.frequency.exponentialRampToValueAtTime(130, t + 0.38);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.42);
  }

  /**
   * Colossal sub-bass abyssal roar + hydraulic breach splash when the Sea Leviathan emerges
   * at the oceanic boundary of the continent.
   */
  public playLeviathanRoar(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // Layer 1: Deep abyssal sub-bass growl (95Hz -> 28Hz over 1.35s)
    const subOsc = ctx.createOscillator();
    const growlOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const shaper = ctx.createWaveShaper();
    const gain = ctx.createGain();

    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(92, t);
    subOsc.frequency.exponentialRampToValueAtTime(34, t + 0.55);
    subOsc.frequency.exponentialRampToValueAtTime(26, t + 1.35);

    growlOsc.type = 'triangle';
    growlOsc.frequency.setValueAtTime(138, t);
    growlOsc.frequency.exponentialRampToValueAtTime(48, t + 0.65);
    growlOsc.frequency.exponentialRampToValueAtTime(36, t + 1.35);
    growlOsc.detune.setValueAtTime(14, t);

    filter.type = 'lowpass';
    filter.Q.setValueAtTime(4.5, t);
    filter.frequency.setValueAtTime(460, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 1.35);

    shaper.curve = this.getSoftClipCurve();
    shaper.oversample = '2x';

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.42, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.24, t + 0.65);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);

    subOsc.connect(shaper);
    growlOsc.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    subOsc.onended = () => {
      subOsc.disconnect();
      growlOsc.disconnect();
      shaper.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    subOsc.start(t);
    growlOsc.start(t);
    subOsc.stop(t + 1.45);
    growlOsc.stop(t + 1.45);

    // Layer 2: Oceanic breach splash burst
    const splashSrc = ctx.createBufferSource();
    splashSrc.buffer = this.getBrownNoiseBuffer(ctx);
    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(380, t);
    splashFilter.frequency.exponentialRampToValueAtTime(140, t + 1.1);
    splashFilter.Q.value = 1.8;

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.0001, t);
    splashGain.gain.linearRampToValueAtTime(0.32, t + 0.05);
    splashGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);

    splashSrc.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(dest);
    splashSrc.onended = () => {
      splashSrc.disconnect();
      splashFilter.disconnect();
      splashGain.disconnect();
    };
    splashSrc.start(t);
    splashSrc.stop(t + 1.2);
  }

  /**
   * Soft aquatic transition chime when opening/closing Pause or the 3D Editor.
   */
  public playMenuOpenClose(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.12);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    osc.connect(gain);
    gain.connect(dest);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Warm harmonic confirmation chime when manually saving or respawning at checkpoint.
   */
  public playSaveConfirm(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const freqs = [440, 554.37, 659.25];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + idx * 0.045;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.14, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  // ============================================================================
  // 3. METEORITE INTRO CINEMATIC SFX (SPACE -> RE-ENTRY -> OCEAN SPLASH -> HATCH)
  // ============================================================================

  /**
   * Phase 1 (0.5s -> 4.8s): Deep gravitational sub-bass hum and Doppler stellar bolide approach in space.
   */
  public playSpaceBolideWhistle(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const dur = 3.8;

    // Layer 1: Detuned gravitational sub-bass drone
    const subOsc1 = ctx.createOscillator();
    const subOsc2 = ctx.createOscillator();
    const subFilter = ctx.createBiquadFilter();
    const subGain = ctx.createGain();

    subOsc1.type = 'sine';
    subOsc1.frequency.setValueAtTime(46, t);
    subOsc1.frequency.exponentialRampToValueAtTime(74, t + dur);

    subOsc2.type = 'triangle';
    subOsc2.frequency.setValueAtTime(69, t);
    subOsc2.frequency.exponentialRampToValueAtTime(111, t + dur);
    subOsc2.detune.value = 6;

    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(140, t);
    subFilter.frequency.exponentialRampToValueAtTime(280, t + dur);

    subGain.gain.setValueAtTime(0.0001, t);
    subGain.gain.linearRampToValueAtTime(0.22, t + 0.7);
    subGain.gain.setValueAtTime(0.22, t + dur - 0.5);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    subOsc1.connect(subFilter);
    subOsc2.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(dest);

    // Layer 2: Filtered solar-wind Doppler rush
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.getPinkNoiseBuffer(ctx);
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(680, t);
    windFilter.frequency.exponentialRampToValueAtTime(260, t + dur);
    windFilter.Q.value = 3.8;

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.0001, t);
    windGain.gain.linearRampToValueAtTime(0.11, t + 0.8);
    windGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(dest);

    const record = {
      gain: subGain,
      stop: () => {
        try {
          subOsc1.stop();
          subOsc2.stop();
          windSrc.stop();
        } catch {
          // Ignore if already stopped
        }
      },
    };
    this.activeCinematicNodes.push(record);

    subOsc1.onended = () => {
      subOsc1.disconnect();
      subOsc2.disconnect();
      subFilter.disconnect();
      subGain.disconnect();
      windSrc.disconnect();
      windFilter.disconnect();
      windGain.disconnect();
    };

    subOsc1.start(t);
    subOsc2.start(t);
    windSrc.start(t);
    subOsc1.stop(t + dur + 0.05);
    subOsc2.stop(t + dur + 0.05);
    windSrc.stop(t + dur + 0.05);
  }

  /**
   * Phase 2 (4.8s -> 8.5s): Multi-layered igneous atmospheric re-entry:
   * 1. Plasma Roar & Supersonic Wind (Pink/Brown noise + Bandpass 120Hz->2200Hz + Fast LFO turbulence)
   * 2. Sub-Bass Gravitational Thermal Drone (Detuned 55Hz triangle & 82Hz sawtooth, 8 cents detune)
   * 3. Wake Friction Sparks & Ash Bursts (Highpass >4000Hz white noise crackles)
   */
  public playMeteorAtmosphericEntry(duration = 3.5): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastReentryPulseAt < 2500) return;
    this.lastReentryPulseAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    // Safeguard if called with a normalized ratio (< 1.2) instead of seconds
    const dur = duration < 1.2 ? 3.5 : duration;
    const t = ctx.currentTime;

    // ------------------------------------------------------------------------
    // LAYER 1: Plasma Roar / Supersonic Wind (Pink + Brown Noise + Bandpass + Fast LFO)
    // ------------------------------------------------------------------------
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = this.getPinkNoiseBuffer(ctx);
    pinkSrc.loop = true;

    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = this.getBrownNoiseBuffer(ctx);
    brownSrc.loop = true;

    const plasmaFilter = ctx.createBiquadFilter();
    plasmaFilter.type = 'bandpass';
    plasmaFilter.frequency.setValueAtTime(120, t);
    plasmaFilter.frequency.exponentialRampToValueAtTime(2200, t + dur * 0.82);
    plasmaFilter.frequency.exponentialRampToValueAtTime(340, t + dur);
    plasmaFilter.Q.value = 2.1;

    // Fast LFO modulating bandpass cutoff to simulate violent air compression & plasma buffeting
    const turbLfo = ctx.createOscillator();
    const turbLfoGain = ctx.createGain();
    turbLfo.type = 'sine';
    turbLfo.frequency.setValueAtTime(13, t);
    turbLfo.frequency.linearRampToValueAtTime(22, t + dur * 0.85);
    turbLfoGain.gain.setValueAtTime(75, t);
    turbLfoGain.gain.linearRampToValueAtTime(360, t + dur * 0.8);

    turbLfo.connect(turbLfoGain);
    turbLfoGain.connect(plasmaFilter.frequency);

    const plasmaGain = ctx.createGain();
    plasmaGain.gain.setValueAtTime(0.0001, t);
    plasmaGain.gain.linearRampToValueAtTime(0.32, t + 0.45);
    plasmaGain.gain.setValueAtTime(0.34, t + dur * 0.78);
    plasmaGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    pinkSrc.connect(plasmaFilter);
    brownSrc.connect(plasmaFilter);
    plasmaFilter.connect(plasmaGain);
    plasmaGain.connect(dest);

    // ------------------------------------------------------------------------
    // LAYER 2: Sub-Bass Gravitational Thermal Drone (55Hz Triangle + 82Hz Sawtooth, ±8 cents detune)
    // ------------------------------------------------------------------------
    const droneTri = ctx.createOscillator();
    const droneSaw = ctx.createOscillator();
    const droneFilter = ctx.createBiquadFilter();
    const droneShaper = ctx.createWaveShaper();
    const droneGain = ctx.createGain();

    droneTri.type = 'triangle';
    droneTri.frequency.setValueAtTime(55, t);
    droneTri.frequency.linearRampToValueAtTime(72, t + dur * 0.8);
    droneTri.frequency.linearRampToValueAtTime(48, t + dur);
    droneTri.detune.setValueAtTime(-8, t);

    droneSaw.type = 'sawtooth';
    droneSaw.frequency.setValueAtTime(82, t);
    droneSaw.frequency.linearRampToValueAtTime(108, t + dur * 0.8);
    droneSaw.frequency.linearRampToValueAtTime(68, t + dur);
    droneSaw.detune.setValueAtTime(8, t);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(190, t);
    droneFilter.frequency.exponentialRampToValueAtTime(480, t + dur * 0.8);
    droneFilter.frequency.exponentialRampToValueAtTime(150, t + dur);
    droneFilter.Q.value = 3.2;

    droneShaper.curve = this.getSoftClipCurve();
    droneShaper.oversample = '2x';

    droneGain.gain.setValueAtTime(0.0001, t);
    droneGain.gain.linearRampToValueAtTime(0.26, t + 0.5);
    droneGain.gain.setValueAtTime(0.28, t + dur * 0.8);
    droneGain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    droneTri.connect(droneFilter);
    droneSaw.connect(droneFilter);
    droneFilter.connect(droneShaper);
    droneShaper.connect(droneGain);
    droneGain.connect(dest);

    // ------------------------------------------------------------------------
    // LAYER 3: Wake Friction Sparks & Incandescent Debris (Random Highpass >4000Hz White Noise Bursts)
    // ------------------------------------------------------------------------
    const sparkSources: AudioBufferSourceNode[] = [];
    const sparkCount = 16;
    for (let i = 0; i < sparkCount; i++) {
      const progress = i / sparkCount;
      const jitter = (Math.random() - 0.5) * 0.12;
      const sparkStart = Math.max(
        t + 0.15,
        Math.min(t + dur - 0.15, t + progress * dur + jitter)
      );
      const sparkDur = 0.028 + Math.random() * 0.045;

      const sparkSrc = ctx.createBufferSource();
      sparkSrc.buffer = this.getWhiteNoiseBuffer(ctx);

      const hpFilter = ctx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.setValueAtTime(4000 + Math.random() * 1800, sparkStart);
      hpFilter.Q.value = 4.5;

      const sparkGain = ctx.createGain();
      const peak = (0.08 + progress * 0.12) * (0.75 + Math.random() * 0.5);
      sparkGain.gain.setValueAtTime(0.0001, sparkStart);
      sparkGain.gain.linearRampToValueAtTime(peak, sparkStart + 0.004);
      sparkGain.gain.exponentialRampToValueAtTime(0.0001, sparkStart + sparkDur);

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      sparkSrc.connect(hpFilter);
      if (panner) {
        panner.pan.setValueAtTime((Math.random() - 0.5) * 1.4, sparkStart);
        hpFilter.connect(panner);
        panner.connect(sparkGain);
      } else {
        hpFilter.connect(sparkGain);
      }
      sparkGain.connect(dest);

      sparkSrc.onended = () => {
        sparkSrc.disconnect();
        hpFilter.disconnect();
        panner?.disconnect();
        sparkGain.disconnect();
      };

      sparkSrc.start(sparkStart, Math.random() * 1.2);
      sparkSrc.stop(sparkStart + sparkDur + 0.01);
      sparkSources.push(sparkSrc);
    }

    const record = {
      gain: plasmaGain,
      stop: () => {
        try {
          pinkSrc.stop();
          brownSrc.stop();
          turbLfo.stop();
          droneTri.stop();
          droneSaw.stop();
          for (const s of sparkSources) {
            try {
              s.stop();
            } catch {
              // Ignore
            }
          }
        } catch {
          // Ignore
        }
      },
    };
    this.activeCinematicNodes.push(record);

    pinkSrc.onended = () => {
      pinkSrc.disconnect();
      brownSrc.disconnect();
      turbLfo.disconnect();
      turbLfoGain.disconnect();
      plasmaFilter.disconnect();
      plasmaGain.disconnect();
      droneTri.disconnect();
      droneSaw.disconnect();
      droneFilter.disconnect();
      droneShaper.disconnect();
      droneGain.disconnect();
    };

    pinkSrc.start(t);
    brownSrc.start(t);
    turbLfo.start(t);
    droneTri.start(t);
    droneSaw.start(t);

    pinkSrc.stop(t + dur + 0.05);
    brownSrc.stop(t + dur + 0.05);
    turbLfo.stop(t + dur + 0.05);
    droneTri.stop(t + dur + 0.05);
    droneSaw.stop(t + dur + 0.05);
  }

  /**
   * Phase 3 (8.5s): Massive ocean impact:
   * 1. Sub-Bass Shockwave Drop (140Hz -> 32Hz in 0.45s through soft-clipping WaveShaper distortion)
   * 2. Hydraulic Explosion / Water Column (White/Brown noise lowpass snapping open and choking over 1.8s)
   * 3. Cavitation & Ascending Micro-Bubbles (Harmonic bubble pops 320Hz - 640Hz)
   */
  public playOceanImpact(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // ------------------------------------------------------------------------
    // LAYER 1: Sub-Bass Shockwave Drop (140Hz -> 32Hz in 0.45s with Soft Saturation)
    // ------------------------------------------------------------------------
    const subOsc = ctx.createOscillator();
    const punchOsc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    const subFilter = ctx.createBiquadFilter();
    const subGain = ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.45);
    subOsc.frequency.exponentialRampToValueAtTime(26, t + 0.85);

    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(95, t);
    punchOsc.frequency.exponentialRampToValueAtTime(28, t + 0.45);

    shaper.curve = this.getSoftClipCurve();
    shaper.oversample = '2x';

    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(260, t);
    subFilter.frequency.exponentialRampToValueAtTime(75, t + 0.55);

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.linearRampToValueAtTime(0.46, t + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.18, t + 0.45);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.88);

    subOsc.connect(shaper);
    punchOsc.connect(shaper);
    shaper.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(dest);

    subOsc.onended = () => {
      subOsc.disconnect();
      punchOsc.disconnect();
      shaper.disconnect();
      subFilter.disconnect();
      subGain.disconnect();
    };
    subOsc.start(t);
    punchOsc.start(t);
    subOsc.stop(t + 0.9);
    punchOsc.stop(t + 0.5);

    // ------------------------------------------------------------------------
    // LAYER 2: Hydraulic Explosion & Water Column Immersion (1.8s Lowpass Envelope)
    // ------------------------------------------------------------------------
    const splashWhite = ctx.createBufferSource();
    splashWhite.buffer = this.getWhiteNoiseBuffer(ctx);

    const splashBrown = ctx.createBufferSource();
    splashBrown.buffer = this.getBrownNoiseBuffer(ctx);

    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'lowpass';
    splashFilter.frequency.setValueAtTime(280, t);
    splashFilter.frequency.exponentialRampToValueAtTime(2400, t + 0.045);
    splashFilter.frequency.exponentialRampToValueAtTime(420, t + 0.55);
    splashFilter.frequency.exponentialRampToValueAtTime(140, t + 1.8);
    splashFilter.Q.value = 2.4;

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.001, t);
    splashGain.gain.linearRampToValueAtTime(0.38, t + 0.03);
    splashGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

    splashWhite.connect(splashFilter);
    splashBrown.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(dest);

    splashWhite.onended = () => {
      splashWhite.disconnect();
      splashBrown.disconnect();
      splashFilter.disconnect();
      splashGain.disconnect();
    };
    splashWhite.start(t);
    splashBrown.start(t);
    splashWhite.stop(t + 1.85);
    splashBrown.stop(t + 1.85);

    // ------------------------------------------------------------------------
    // LAYER 3: Cavitation & Ascending Micro-Bubbles (320Hz - 640Hz Harmonic Pops)
    // ------------------------------------------------------------------------
    const bubbleBaseFreqs = [
      320, 360, 400, 440, 480, 512, 540, 576, 600, 620, 640, 480,
    ];
    bubbleBaseFreqs.forEach((bf, i) => {
      const start = t + 0.14 + i * 0.125 + (Math.random() - 0.5) * 0.03;
      const bDur = 0.065 + (i % 3) * 0.022;

      const bOsc = ctx.createOscillator();
      const bFilter = ctx.createBiquadFilter();
      const bGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bf * 0.78, start);
      bOsc.frequency.exponentialRampToValueAtTime(bf * 1.42, start + bDur);

      bFilter.type = 'bandpass';
      bFilter.frequency.setValueAtTime(bf, start);
      bFilter.Q.value = 3.5;

      const peak = 0.13 * (1 - i / (bubbleBaseFreqs.length * 1.35));
      bGain.gain.setValueAtTime(0.0001, start);
      bGain.gain.linearRampToValueAtTime(peak, start + 0.01);
      bGain.gain.exponentialRampToValueAtTime(0.0001, start + bDur);

      bOsc.connect(bFilter);
      if (panner) {
        panner.pan.setValueAtTime(Math.sin(i * 1.7) * 0.65, start);
        bFilter.connect(panner);
        panner.connect(bGain);
      } else {
        bFilter.connect(bGain);
      }
      bGain.connect(dest);

      bOsc.onended = () => {
        bOsc.disconnect();
        bFilter.disconnect();
        panner?.disconnect();
        bGain.disconnect();
      };
      bOsc.start(start);
      bOsc.stop(start + bDur + 0.01);
    });
  }

  /**
   * Phase 4 (11.2s): Mineral Crystalline Fracture & Bioluminescent Panspermia Awakening Chord:
   * 1. Crystalline Mineral Fracture (4 sharp metallic/mineral impulses in 1200Hz - 2800Hz + tectonic low snap)
   * 2. Panspermia Awakening Chord (Suspended major triad with 1.2s soft attack & diffuse stereo reverb)
   */
  public playMeteorCrackOpen(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // ------------------------------------------------------------------------
    // LAYER 1: Tectonic Mineral & Crystalline Fracture (4 impulses 1200Hz - 2800Hz)
    // ------------------------------------------------------------------------
    const lowCrackOsc = ctx.createOscillator();
    const lowCrackGain = ctx.createGain();
    lowCrackOsc.type = 'sawtooth';
    lowCrackOsc.frequency.setValueAtTime(240, t);
    lowCrackOsc.frequency.exponentialRampToValueAtTime(42, t + 0.36);

    lowCrackGain.gain.setValueAtTime(0.001, t);
    lowCrackGain.gain.linearRampToValueAtTime(0.3, t + 0.008);
    lowCrackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    lowCrackOsc.connect(lowCrackGain);
    lowCrackGain.connect(dest);
    lowCrackOsc.onended = () => {
      lowCrackOsc.disconnect();
      lowCrackGain.disconnect();
    };
    lowCrackOsc.start(t);
    lowCrackOsc.stop(t + 0.4);

    const crystalImpulses = [
      { delay: 0.0, freq: 1280, modFreq: 1940, pan: -0.45 },
      { delay: 0.068, freq: 1760, modFreq: 2480, pan: 0.48 },
      { delay: 0.145, freq: 2240, modFreq: 1520, pan: -0.32 },
      { delay: 0.235, freq: 2780, modFreq: 2110, pan: 0.38 },
    ];

    crystalImpulses.forEach((imp) => {
      const start = t + imp.delay;
      const impDur = 0.14;

      const carrier = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const noiseBurst = ctx.createBufferSource();
      noiseBurst.buffer = this.getWhiteNoiseBuffer(ctx);

      const bpFilter = ctx.createBiquadFilter();
      const impGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      carrier.type = 'triangle';
      carrier.frequency.setValueAtTime(imp.freq, start);
      carrier.frequency.exponentialRampToValueAtTime(
        imp.freq * 0.72,
        start + impDur
      );

      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(imp.modFreq, start);
      harmonic.frequency.exponentialRampToValueAtTime(
        imp.modFreq * 0.85,
        start + impDur
      );

      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(imp.freq, start);
      bpFilter.Q.value = 7.5;

      impGain.gain.setValueAtTime(0.0001, start);
      impGain.gain.linearRampToValueAtTime(0.22, start + 0.004);
      impGain.gain.exponentialRampToValueAtTime(0.0001, start + impDur);

      carrier.connect(bpFilter);
      harmonic.connect(bpFilter);
      noiseBurst.connect(bpFilter);

      if (panner) {
        panner.pan.setValueAtTime(imp.pan, start);
        bpFilter.connect(panner);
        panner.connect(impGain);
      } else {
        bpFilter.connect(impGain);
      }
      impGain.connect(dest);

      carrier.onended = () => {
        carrier.disconnect();
        harmonic.disconnect();
        noiseBurst.disconnect();
        bpFilter.disconnect();
        panner?.disconnect();
        impGain.disconnect();
      };

      carrier.start(start);
      harmonic.start(start);
      noiseBurst.start(start, Math.random() * 0.5);
      carrier.stop(start + impDur + 0.01);
      harmonic.stop(start + impDur + 0.01);
      noiseBurst.stop(start + 0.05);
    });

    // ------------------------------------------------------------------------
    // LAYER 2: Panspermia Bioluminescent Awakening Chord (Suspended Major Triad, 1.2s Attack + Diffuse Reverb)
    // ------------------------------------------------------------------------
    const chordStart = t + 0.16;
    const chordDuration = 3.1;
    const attackTime = 1.2;

    // Diffuse stereo delay reverb bus
    const dryBus = ctx.createGain();
    const delayL = ctx.createDelay(1.0);
    const delayR = ctx.createDelay(1.0);
    const fbGainL = ctx.createGain();
    const fbGainR = ctx.createGain();
    const reverbFilter = ctx.createBiquadFilter();
    const wetGain = ctx.createGain();

    delayL.delayTime.setValueAtTime(0.19, chordStart);
    delayR.delayTime.setValueAtTime(0.27, chordStart);
    fbGainL.gain.setValueAtTime(0.38, chordStart);
    fbGainR.gain.setValueAtTime(0.36, chordStart);
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.setValueAtTime(1850, chordStart);
    wetGain.gain.setValueAtTime(0.45, chordStart);

    dryBus.connect(dest);
    dryBus.connect(delayL);
    dryBus.connect(delayR);

    delayL.connect(fbGainL);
    fbGainL.connect(reverbFilter);
    reverbFilter.connect(delayR);

    delayR.connect(fbGainR);
    fbGainR.connect(delayL);

    delayL.connect(wetGain);
    delayR.connect(wetGain);
    wetGain.connect(dest);

    // Suspended major triad + luminous extensions: C4, F4, G4, E4, C5, D5, G5
    const panspermiaVoices = [
      { freq: 261.63, detune: -6, pan: -0.25, peak: 0.095 },
      { freq: 349.23, detune: 5, pan: 0.25, peak: 0.08 },
      { freq: 392.0, detune: -4, pan: -0.4, peak: 0.09 },
      { freq: 329.63, detune: 6, pan: 0.35, peak: 0.085 },
      { freq: 523.25, detune: -7, pan: -0.5, peak: 0.075 },
      { freq: 587.33, detune: 7, pan: 0.5, peak: 0.068 },
      { freq: 783.99, detune: 4, pan: 0.0, peak: 0.06 },
    ];

    panspermiaVoices.forEach((v, idx) => {
      const noteStart = chordStart + idx * 0.045;
      const oscSine = ctx.createOscillator();
      const oscTri = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const voiceGain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(v.freq, noteStart);
      oscSine.detune.setValueAtTime(v.detune, noteStart);

      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(v.freq, noteStart);
      oscTri.detune.setValueAtTime(-v.detune, noteStart);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(480, noteStart);
      filter.frequency.exponentialRampToValueAtTime(
        2200,
        noteStart + attackTime
      );
      filter.frequency.exponentialRampToValueAtTime(
        620,
        noteStart + chordDuration
      );

      voiceGain.gain.setValueAtTime(0.0001, noteStart);
      voiceGain.gain.linearRampToValueAtTime(v.peak, noteStart + attackTime);
      voiceGain.gain.exponentialRampToValueAtTime(
        0.0001,
        noteStart + chordDuration
      );

      oscSine.connect(filter);
      oscTri.connect(filter);
      if (panner) {
        panner.pan.setValueAtTime(v.pan, noteStart);
        filter.connect(panner);
        panner.connect(voiceGain);
      } else {
        filter.connect(voiceGain);
      }
      voiceGain.connect(dryBus);

      oscSine.onended = () => {
        oscSine.disconnect();
        oscTri.disconnect();
        filter.disconnect();
        panner?.disconnect();
        voiceGain.disconnect();
        if (idx === panspermiaVoices.length - 1) {
          window.setTimeout(() => {
            dryBus.disconnect();
            delayL.disconnect();
            delayR.disconnect();
            fbGainL.disconnect();
            fbGainR.disconnect();
            reverbFilter.disconnect();
            wetGain.disconnect();
          }, 900);
        }
      };

      oscSine.start(noteStart);
      oscTri.start(noteStart);
      oscSine.stop(noteStart + chordDuration + 0.05);
      oscTri.stop(noteStart + chordDuration + 0.05);
    });
  }

  /**
   * Stops any active long-running cinematic sounds (e.g., when skipping intro with [Space]).
   */
  public stopCinematicSounds(): void {
    while (this.activeCinematicNodes.length > 0) {
      const item = this.activeCinematicNodes.pop();
      item?.stop();
    }
  }

  // ============================================================================
  // 4. POLYPHONIC ADAPTIVE MUSIC SYNTHESIZER ('menu' | 'ocean' | 'combat' | 'editor')
  // ============================================================================

  /**
   * Smoothly transitions the procedural background soundtrack to the target state:
   * - Entering 'combat': 0.35s click-free crossfade to the 140 BPM multi-layer pursuit theme.
   * - Returning from 'combat' to 'ocean': 1.5s smooth crossfade back to the peaceful marine melody.
   */
  public transitionMusicTo(nextState: AdaptiveMusicState): void {
    if (this.currentMusicState === nextState) return;
    const prevState = this.currentMusicState;
    this.currentMusicState = nextState;

    if (nextState !== 'combat' && prevState !== 'combat') {
      this.musicStepIndex = 0;
    }

    if (nextState === 'none') {
      this.stopMusicScheduler();
      this.stopOceanCurrentDrone();
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (this.peacefulBusGain && this.combatBusGain) {
      const pGain = this.peacefulBusGain.gain;
      const cGain = this.combatBusGain.gain;
      pGain.cancelScheduledValues(now);
      cGain.cancelScheduledValues(now);
      pGain.setValueAtTime(Math.max(0.0001, pGain.value), now);
      cGain.setValueAtTime(Math.max(0.0001, cGain.value), now);

      if (nextState === 'combat') {
        // Fast 0.35s adrenaline crossfade into combat pursuit
        this.combatTailUntilTime = 0;
        pGain.linearRampToValueAtTime(0.0001, now + 0.35);
        cGain.linearRampToValueAtTime(1.0, now + 0.35);
      } else if (prevState === 'combat') {
        // Smooth 1.5s relief crossfade back to peaceful ocean/menu/editor music
        this.combatTailUntilTime = now + 1.5;
        cGain.linearRampToValueAtTime(0.0001, now + 1.5);
        pGain.linearRampToValueAtTime(1.0, now + 1.5);
      } else {
        cGain.linearRampToValueAtTime(0.0001, now + 0.25);
        pGain.linearRampToValueAtTime(1.0, now + 0.25);
      }
    }

    if (nextState === 'ocean' || nextState === 'combat') {
      this.ensureOceanCurrentDrone();
    } else {
      this.stopOceanCurrentDrone();
    }

    if (!this.musicSchedulerId) {
      this.startMusicScheduler();
    }
  }

  private ensureOceanCurrentDrone(): void {
    const ctx = this.getContext();
    if (!ctx || !this.musicGain || this.oceanCurrentSource) return;

    try {
      const src = ctx.createBufferSource();
      src.buffer = this.getPinkNoiseBuffer(ctx);
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 185;
      filter.Q.value = 1.6;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.setTargetAtTime(0.11, ctx.currentTime, 0.5);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      src.start();

      this.oceanCurrentSource = src;
      this.oceanCurrentFilter = filter;
      this.oceanCurrentGain = gain;
    } catch {
      // Ignore if context not ready
    }
  }

  private stopOceanCurrentDrone(): void {
    if (this.ctx && this.bubblingBusGain) {
      this.bubblingBusGain.gain.setTargetAtTime(
        0.0001,
        this.ctx.currentTime,
        0.2
      );
    }
    if (this.oceanCurrentSource && this.ctx) {
      try {
        if (this.oceanCurrentGain) {
          this.oceanCurrentGain.gain.setTargetAtTime(
            0.0001,
            this.ctx.currentTime,
            0.25
          );
        }
        this.oceanCurrentSource.stop(this.ctx.currentTime + 0.3);
      } catch {
        // Ignore
      }
      this.oceanCurrentSource = null;
      this.oceanCurrentFilter = null;
      this.oceanCurrentGain = null;
    }
  }

  /**
   * Ajusta en tiempo real el paisaje sonoro ambiental ('corrientes' y 'burbujeo')
   * en función de la profundidad actual de la célula (0..1) y la intensidad de actividad (0..1).
   */
  public updateAmbientSoundscape(
    delta: number,
    depthNorm: number,
    activityNorm: number,
    isNearThermalVent = false,
    isUnderwater = true
  ): void {
    if (this.getEffectiveMusicVolume() <= 0.01) return;
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const clampedDepth = Math.max(0, Math.min(1, depthNorm));
    const clampedActivity = Math.max(0, Math.min(1, activityNorm));
    this.currentDepthNorm = clampedDepth;
    this.currentActivityNorm = clampedActivity;

    const now = ctx.currentTime;

    if (
      !isUnderwater ||
      this.currentMusicState === 'menu' ||
      this.currentMusicState === 'editor' ||
      this.currentMusicState === 'none'
    ) {
      this.currentBubblingVolume = 0;
      this.currentCurrentsVolume = 0;
      if (this.oceanCurrentGain) {
        this.oceanCurrentGain.gain.setTargetAtTime(0.0001, now, 0.25);
      }
      if (this.bubblingBusGain) {
        this.bubblingBusGain.gain.setTargetAtTime(0.0001, now, 0.2);
      }
      return;
    }

    this.ensureOceanCurrentDrone();

    // 1. Modulación de 'Corrientes' (Sub-aquatic currents):
    // Mayor profundidad aumenta la presión y el peso de la corriente de fondo;
    // mayor actividad (velocidad de nado, impulso, combate) abre el filtro paso-bajo e intensifica el flujo hidrodinámico.
    const baseCurrentGain = 0.065 + clampedDepth * 0.115;
    const activityCurrentBoost = clampedActivity * 0.145;
    const ventCurrentBoost = isNearThermalVent ? 0.045 : 0;
    const targetCurrentsGain = Math.min(
      0.34,
      baseCurrentGain + activityCurrentBoost + ventCurrentBoost
    );
    this.currentCurrentsVolume = targetCurrentsGain;

    if (this.oceanCurrentGain) {
      this.oceanCurrentGain.gain.setTargetAtTime(targetCurrentsGain, now, 0.12);
    }
    if (this.oceanCurrentFilter) {
      // Aguas someras: filtro más brillante (~225Hz base); aguas abisales: más grave (~115Hz base).
      // Al nadar rápido o usar boost, el flujo hidrodinámico eleva la frecuencia de corte hasta +320Hz.
      const depthBaseCutoff = 225 - clampedDepth * 110;
      const targetCutoff = Math.max(
        95,
        Math.min(640, depthBaseCutoff + clampedActivity * 320)
      );
      this.oceanCurrentFilter.frequency.setTargetAtTime(
        targetCutoff,
        now,
        0.12
      );
      this.oceanCurrentFilter.Q.setTargetAtTime(
        1.4 + clampedDepth * 1.3 + clampedActivity * 0.8,
        now,
        0.15
      );
    }

    // 2. Modulación de 'Burbujeo' (Cavitation & Hydrothermal/Photosynthetic Bubbling):
    // El volumen y cadencia de burbujeo crecen con la intensidad de actividad (propulsión flagelar/combate),
    // la oxigenación superficial o las fumarolas hidrotermales en aguas profundas.
    const shallowOxygenFactor = (1.0 - clampedDepth * 0.45) * 0.09;
    const deepTrenchFactor = clampedDepth * 0.08;
    const activityBubbleBoost = clampedActivity * 0.22;
    const ventBubbleBoost = isNearThermalVent ? 0.15 : 0;

    const targetBubblingGain = Math.min(
      0.42,
      shallowOxygenFactor +
        deepTrenchFactor +
        activityBubbleBoost +
        ventBubbleBoost
    );
    this.currentBubblingVolume = targetBubblingGain;

    if (this.bubblingBusGain) {
      this.bubblingBusGain.gain.setTargetAtTime(targetBubblingGain, now, 0.1);
    }

    const safeDelta = Math.min(Math.max(delta, 0.001), 0.1);
    const bubbleRatePerSec =
      1.1 +
      clampedActivity * 4.8 +
      (isNearThermalVent ? 2.6 : 0) +
      clampedDepth * 0.75;
    this.bubblingSpawnAccumulator += safeDelta * bubbleRatePerSec;

    if (this.bubblingSpawnAccumulator >= 1.0) {
      const count = Math.min(3, Math.floor(this.bubblingSpawnAccumulator));
      this.bubblingSpawnAccumulator -= count;
      this.triggerAmbientBubbleCluster(
        clampedDepth,
        clampedActivity,
        isNearThermalVent,
        count
      );
    }
  }

  private triggerAmbientBubbleCluster(
    depthNorm: number,
    activityNorm: number,
    isNearThermalVent: boolean,
    count: number
  ): void {
    const ctx = this.ctx;
    const dest = this.bubblingBusGain;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    // En superficie: burbujas cristalinas y agudas (440-880 Hz).
    // En fosas abisales: burbujas densas y resonantes de baja frecuencia (185-420 Hz).
    const minFreq = 440 - depthNorm * 255;
    const maxFreq = 860 - depthNorm * 430;

    for (let i = 0; i < count; i++) {
      const delay = i * (0.045 + Math.random() * 0.055);
      const start = now + delay;
      const dur = 0.045 + (1 - activityNorm * 0.35) * 0.04 + depthNorm * 0.025;
      const baseFreq = minFreq + Math.random() * (maxFreq - minFreq);

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * 0.76, start);
      osc.frequency.exponentialRampToValueAtTime(
        baseFreq * (1.38 + activityNorm * 0.22),
        start + dur
      );

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(baseFreq, start);
      filter.Q.value =
        3.2 + depthNorm * 2.8 + (isNearThermalVent ? 1.5 : 0);

      const peak = 0.14 + activityNorm * 0.1 + (isNearThermalVent ? 0.05 : 0);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(filter);
      if (panner) {
        panner.pan.setValueAtTime((Math.random() * 2 - 1) * 0.65, start);
        filter.connect(panner);
        panner.connect(gain);
      } else {
        filter.connect(gain);
      }
      gain.connect(dest);

      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        panner?.disconnect();
        gain.disconnect();
      };

      osc.start(start);
      osc.stop(start + dur + 0.01);
    }
  }

  public getAmbientSoundscapeTelemetry(): {
    depthNorm: number;
    activityNorm: number;
    bubblingVolume: number;
    currentsVolume: number;
  } {
    return {
      depthNorm: this.currentDepthNorm,
      activityNorm: this.currentActivityNorm,
      bubblingVolume: this.currentBubblingVolume,
      currentsVolume: this.currentCurrentsVolume,
    };
  }

  private startMusicScheduler(): void {
    if (typeof window === 'undefined' || this.musicSchedulerId !== null) return;
    // 107ms tick = 140 BPM sixteenth-note (semicorchea) grid:
    // 1 quarter note (negra) = 4 steps (~428.5ms)
    // 1 eighth note (corchea) = 2 steps (~214.3ms)
    // 1 sixteenth note (semicorchea) = 1 step (~107.1ms)
    this.musicSchedulerId = window.setInterval(() => {
      this.tickAdaptiveMusicStep();
    }, 107);
  }

  private stopMusicScheduler(): void {
    if (this.musicSchedulerId !== null) {
      window.clearInterval(this.musicSchedulerId);
      this.musicSchedulerId = null;
    }
  }

  private tickAdaptiveMusicStep(): void {
    if (this.currentMusicState === 'none') return;
    if (this.getEffectiveMusicVolume() <= 0.01) return;
    if (!this.ctx || this.ctx.state !== 'running') return;

    const peacefulDest = this.getMusicDestination();
    const combatDest = this.getCombatMusicDestination();
    if (!peacefulDest || !combatDest) return;

    const step16 = this.musicStepIndex++;
    const t = this.ctx.currentTime;

    // If in 'combat' OR within the 1.5s crossfade tail after escaping a predator, tick the 140 BPM combat layers
    if (
      this.currentMusicState === 'combat' ||
      t < this.combatTailUntilTime
    ) {
      this.tickCombatMusicLayers(step16, t, combatDest);
    }

    if (this.currentMusicState === 'combat') {
      return;
    }

    // For peaceful states ('menu', 'ocean', 'editor'), run on eighth-note subdivisions (every 2 sixteenth steps)
    if (step16 % 2 !== 0) return;
    const step = Math.floor(step16 / 2);

    switch (this.currentMusicState) {
      case 'menu': {
        // Canal A (Menú Principal / Sistema Solar): Acordes espaciales etéreos y lentos
        if (step % 14 === 0) {
          const chordSets = [
            [130.81, 196.0, 246.94, 293.66], // Cmaj9 cosmic
            [110.0, 164.81, 220.0, 261.63], // Am7 nebula
            [146.83, 220.0, 277.18, 329.63], // Dmaj7 starlight
            [98.0, 146.83, 196.0, 246.94], // G6 deep orbit
          ];
          const chord =
            chordSets[Math.floor(step / 14) % chordSets.length];
          chord.forEach((freq, idx) => {
            this.scheduleEtherealPadNote(
              freq,
              t + idx * 0.18,
              3.2,
              0.042,
              peacefulDest
            );
          });
        }
        break;
      }

      case 'ocean': {
        // Canal B (Océano Tranquilo / Exploración Celular): Melodía pentatónica submarina
        const pentatonic = [
          261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25,
        ];
        if (step % 2 === 0 || step % 7 === 3) {
          const patternIdx =
            (step * 3 + Math.floor(step / 8)) % pentatonic.length;
          const noteFreq = pentatonic[patternIdx];
          this.scheduleWaterMarimbaNote(
            noteFreq,
            t,
            0.36,
            0.065,
            peacefulDest
          );
        }
        if (step % 8 === 0) {
          const bassRoots = [130.81, 146.83, 164.81, 196.0];
          const root = bassRoots[Math.floor(step / 8) % bassRoots.length];
          this.scheduleWaterMarimbaNote(root, t, 0.95, 0.055, peacefulDest);
        }
        break;
      }

      case 'editor': {
        // Canal D (Taller Evolutivo 3D): Música minimalista y cálida de laboratorio
        if (step % 8 === 0) {
          const workshopChords = [
            [261.63, 329.63, 392.0], // C major
            [349.23, 440.0, 523.25], // F major
            [293.66, 369.99, 440.0], // D major warm
            [392.0, 493.88, 587.33], // G major
          ];
          const chord =
            workshopChords[Math.floor(step / 8) % workshopChords.length];
          chord.forEach((f, idx) => {
            this.scheduleEtherealPadNote(
              f,
              t + idx * 0.08,
              1.8,
              0.038,
              peacefulDest
            );
          });
        }
        if (step % 4 === 2) {
          const bellNotes = [523.25, 659.25, 783.99, 880.0, 1046.5];
          const bf = bellNotes[(step / 2) % bellNotes.length];
          this.scheduleWaterMarimbaNote(bf, t, 0.48, 0.042, peacefulDest);
        }
        break;
      }
    }
  }

  /**
   * 140 BPM Multi-Layer Pursuit & Threat Soundtrack ('combat') inspired by Spore & Subnautica:
   * - Layer 1: Underwater Heartbeat Kick (Quarter notes, dual muffled pulse 95Hz -> 40Hz with 110Hz lowpass)
   * - Layer 2: Oppressive Acid Sawtooth Bassline (Eighth notes in C Harmonic Minor, resonant cutoff sweeping 250Hz -> 950Hz over 4 bars)
   * - Layer 3: Bioluminescent Organic Percussion (Sixteenth-note mandible snaps & fin clicks in the abyss)
   */
  private tickCombatMusicLayers(
    step16: number,
    t: number,
    dest: AudioNode
  ): void {
    // ------------------------------------------------------------------------
    // LAYER 1: Underwater Heartbeat Kick (Every quarter note = 4 sixteenth steps at 140 BPM)
    // Dual pulse: "Dum-dum... Dum-dum..."
    // ------------------------------------------------------------------------
    if (step16 % 4 === 0) {
      // Primary systolic beat ("Dum-")
      this.scheduleHeartbeatKick(95, 40, t, 0.16, 0.22, dest);
      // Secondary diastolic beat ("-dum") 145ms later
      const secondaryPeak = step16 % 8 === 0 ? 0.16 : 0.11;
      this.scheduleHeartbeatKick(84, 38, t + 0.145, 0.14, secondaryPeak, dest);
    }

    // ------------------------------------------------------------------------
    // LAYER 2: Acid Harmonic Minor Bassline (Every eighth note = 2 sixteenth steps)
    // Filter cutoff sweeps from 250Hz to 950Hz across a 4-bar (64 sixteenth-step) cycle
    // ------------------------------------------------------------------------
    if (step16 % 2 === 0) {
      const eigthIdx = Math.floor(step16 / 2);
      // C Harmonic Minor arpeggio: C2, G2, Ab2, G2, C2, Eb2, F2, B2, C2, G2, Ab2, B2, C3, B2, Ab2, G2
      const harmonicMinorArp = [
        65.41, 98.0, 103.83, 98.0, 65.41, 77.78, 87.31, 123.47,
        65.41, 98.0, 103.83, 123.47, 130.81, 123.47, 103.83, 98.0,
      ];
      const bassFreq = harmonicMinorArp[eigthIdx % harmonicMinorArp.length];

      // 4-bar (64 sixteenth steps) filter cutoff sweep from 250 Hz to 950 Hz
      const fourBarProgress = (step16 % 64) / 63;
      const cutoffHz = 250 + fourBarProgress * 700;
      const isAccent = eigthIdx % 4 === 0 || eigthIdx % 8 === 7;

      this.scheduleAcidBassNote(
        bassFreq,
        cutoffHz,
        t,
        0.19,
        isAccent ? 0.115 : 0.088,
        isAccent,
        dest
      );
    }

    // ------------------------------------------------------------------------
    // LAYER 3: Bioluminescent Organic Percussion (16th-note mandible clicks & fin snaps)
    // ------------------------------------------------------------------------
    const sixteenthInBar = step16 % 16;
    const clickPattern = [
      1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1,
    ];
    if (clickPattern[sixteenthInBar]) {
      const isSharpSnap = sixteenthInBar === 4 || sixteenthInBar === 12;
      this.scheduleBioluminescentPercussion(
        step16,
        t,
        isSharpSnap,
        dest
      );
    }
  }

  private scheduleHeartbeatKick(
    startFreq: number,
    endFreq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const shaper = this.ctx.createWaveShaper();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(110, startTime);
    filter.Q.value = 1.8;

    shaper.curve = this.getSoftClipCurve();

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      shaper.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.015);
  }

  private scheduleAcidBassNote(
    freq: number,
    cutoffHz: number,
    startTime: number,
    duration: number,
    peakGain: number,
    isAccent: boolean,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const sawOsc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(freq, startTime);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(freq * 0.5, startTime);

    filter.type = 'lowpass';
    const peakCutoff = Math.min(2400, cutoffHz * (isAccent ? 1.45 : 1.15));
    const endCutoff = Math.max(135, cutoffHz * 0.38);
    filter.frequency.setValueAtTime(peakCutoff, startTime);
    filter.frequency.exponentialRampToValueAtTime(
      endCutoff,
      startTime + duration
    );
    filter.Q.value = isAccent ? 6.8 : 5.2;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    sawOsc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    sawOsc.onended = () => {
      sawOsc.disconnect();
      subOsc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    sawOsc.start(startTime);
    subOsc.start(startTime);
    sawOsc.stop(startTime + duration + 0.015);
    subOsc.stop(startTime + duration + 0.015);
  }

  private scheduleBioluminescentPercussion(
    step16: number,
    startTime: number,
    isSharpSnap: boolean,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const dur = isSharpSnap ? 0.045 : 0.026;

    // Chitinous / bioluminescent resonant click oscillator
    const clickOsc = this.ctx.createOscillator();
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.getWhiteNoiseBuffer(this.ctx);

    const bpFilter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner
      ? this.ctx.createStereoPanner()
      : null;

    const basePitch = isSharpSnap
      ? 1480
      : 1950 + ((step16 * 137) % 900);

    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(basePitch, startTime);
    clickOsc.frequency.exponentialRampToValueAtTime(
      basePitch * 0.42,
      startTime + dur
    );

    bpFilter.type = 'bandpass';
    bpFilter.frequency.setValueAtTime(basePitch * 1.2, startTime);
    bpFilter.Q.value = isSharpSnap ? 4.2 : 6.5;

    const peak = isSharpSnap ? 0.055 : 0.032;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peak, startTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    clickOsc.connect(bpFilter);
    noiseSrc.connect(bpFilter);

    if (panner) {
      const panVal = Math.sin(step16 * 1.35) * 0.55;
      panner.pan.setValueAtTime(panVal, startTime);
      bpFilter.connect(panner);
      panner.connect(gain);
    } else {
      bpFilter.connect(gain);
    }
    gain.connect(dest);

    clickOsc.onended = () => {
      clickOsc.disconnect();
      noiseSrc.disconnect();
      bpFilter.disconnect();
      panner?.disconnect();
      gain.disconnect();
    };

    clickOsc.start(startTime);
    noiseSrc.start(startTime, (step16 % 16) * 0.08);
    clickOsc.stop(startTime + dur + 0.008);
    noiseSrc.stop(startTime + dur + 0.008);
  }

  private scheduleEtherealPadNote(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const panner = this.ctx.createStereoPanner
      ? this.ctx.createStereoPanner()
      : null;
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, startTime);

    const attack = Math.min(1.4, duration * 0.42);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    if (panner) {
      panner.pan.setValueAtTime(Math.sin(startTime * 0.7) * 0.45, startTime);
      filter.connect(panner);
      panner.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      panner?.disconnect();
      gain.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private scheduleWaterMarimbaNote(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(
      freq * 1.006,
      startTime + duration * 0.5
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /**
   * Sintetizador procedural para los eventos del ritual reproductivo de Spore:
   * - 'mating_call_emit': Canto sonar bioluminiscente ascendente + eco armónico
   * - 'egg_heartbeat': Latido embrionario doble (lub-dub) profundo del huevo
   * - 'egg_hatch_burst': Eclosión cristalina del cascarón y acorde de nacimiento
   */
  public playSound(
    soundId:
      | 'mating_success_jingle'
      | 'mating_call_emit'
      | 'egg_heartbeat'
      | 'egg_hatch_burst'
  ): void {
    this.playSFX(soundId);
  }

  public playSFX(
    sfxId:
      | 'mating_call_emit'
      | 'mating_success_jingle'
      | 'egg_heartbeat'
      | 'egg_hatch_burst'
  ): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const now = ctx.currentTime;

    if (sfxId === 'mating_success_jingle') {
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.38);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.16 * vol, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.45);
      });
      return;
    }

    if (sfxId === 'mating_call_emit') {

      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 0.92, start);
        osc.frequency.exponentialRampToValueAtTime(freq, start + 0.08);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.04, start + 0.42);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.14 * vol, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.48);
      });
      return;
    }

    if (sfxId === 'egg_heartbeat') {
      const pulses = [0, 0.18];
      pulses.forEach((offset, idx) => {
        const start = now + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const baseFreq = idx === 0 ? 95 : 118;
        osc.frequency.setValueAtTime(baseFreq, start);
        osc.frequency.exponentialRampToValueAtTime(42, start + 0.14);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.24 * vol, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.18);
      });
      return;
    }

    if (sfxId === 'egg_hatch_burst') {
      const chord = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      chord.forEach((freq, idx) => {
        const start = now + idx * 0.04;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.06, start + 0.45);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.12 * vol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.52);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    }
  }
}

export const audioManager = new AudioManager();

export interface AmbientAudioUpdateParams {
  delta: number;
  x: number;
  y: number;
  z: number;
  arenaRadius: number;
  growthStage: number;
  biomeId: string;
  isNearThermalVent: boolean;
  isCreatureStage: boolean;
  currentSpeed: number;
  isBoosting: boolean;
  inCombatAlert: boolean;
  nearestPredatorDistance: number;
  isAbilityActive: boolean;
}

/**
 * Gestor de Audio Ambiental en tiempo real para `GameEngine`:
 * Evalúa la profundidad batimétrica actual de la célula y la intensidad de actividad
 * (nado, impulso, combate y habilidades) para modular suavemente los canales de
 * 'burbujeo' y 'corrientes' en el motor de síntesis Web Audio.
 */
export class AmbientAudioManager {
  private readonly audio: AudioManager;
  private smoothedDepth = 0.25;
  private smoothedActivity = 0.05;

  constructor(audio: AudioManager = audioManager) {
    this.audio = audio;
  }

  public update(params: AmbientAudioUpdateParams): void {
    const safeDelta = Math.min(Math.max(params.delta, 0.001), 0.1);

    // 1. Calcular profundidad normalizada (0 = aguas someras luminosas, 1 = fosa abisal profunda)
    const radialDist = Math.hypot(params.x, params.z);
    const radialNorm = Math.min(
      1.0,
      radialDist / Math.max(60, params.arenaRadius)
    );
    const stageDepthFactor = Math.max(
      0,
      Math.min(1, (params.growthStage - 1) / 4)
    );
    const biomeDepthBonus =
      params.biomeId === 'fosa_termal'
        ? 0.28
        : params.biomeId === 'arrecife_abisal'
        ? 0.22
        : 0.0;
    const verticalDepthFactor = params.isCreatureStage
      ? Math.max(0, Math.min(1, (-params.y + 1.5) / 8.0))
      : radialNorm * 0.55 + stageDepthFactor * 0.3 + biomeDepthBonus;

    const targetDepth = Math.max(0, Math.min(1, verticalDepthFactor));

    // 2. Calcular intensidad de actividad (0 = reposo tranquilo, 1 = frenesí / impulso / combate)
    const speedNorm = Math.min(1.0, Math.abs(params.currentSpeed) / 14.0);
    const boostBonus = params.isBoosting ? 0.32 : 0.0;
    const combatBonus = params.inCombatAlert
      ? 0.35
      : params.nearestPredatorDistance < 28.0
      ? 0.16 * (1.0 - params.nearestPredatorDistance / 28.0)
      : 0.0;
    const abilityBonus = params.isAbilityActive ? 0.22 : 0.0;

    const targetActivity = Math.max(
      0,
      Math.min(1, speedNorm * 0.55 + boostBonus + combatBonus + abilityBonus)
    );

    // Suavizado exponencial para evitar saltos bruscos de volumen
    const lerpFactor = Math.min(1.0, safeDelta * 4.5);
    this.smoothedDepth += (targetDepth - this.smoothedDepth) * lerpFactor;
    this.smoothedActivity +=
      (targetActivity - this.smoothedActivity) * lerpFactor;

    const isUnderwater = !params.isCreatureStage || params.y < 0.85;

    this.audio.updateAmbientSoundscape(
      safeDelta,
      this.smoothedDepth,
      this.smoothedActivity,
      params.isNearThermalVent,
      isUnderwater
    );
  }

  public silence(delta = 0.016): void {
    this.audio.updateAmbientSoundscape(
      delta,
      this.smoothedDepth,
      0,
      false,
      false
    );
  }
}
