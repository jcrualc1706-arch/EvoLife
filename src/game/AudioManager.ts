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
  private oceanCurrentSource: AudioBufferSourceNode | null = null;
  private oceanCurrentGain: GainNode | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;

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
    return this.musicGain ?? ctx.destination;
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
   * Chitinous/metallic shield deflection sound when armor, shield plates, or mucus absorb incoming damage.
   */
  public playShieldDeflect(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastShieldAt < 110) return;
    this.lastShieldAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // Resonant chitinous ricochet ping
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(640, t);
    osc1.frequency.exponentialRampToValueAtTime(1120, t + 0.045);
    osc1.frequency.exponentialRampToValueAtTime(480, t + 0.18);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1480, t);
    osc2.frequency.exponentialRampToValueAtTime(920, t + 0.16);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1050, t);
    filter.Q.value = 4.2;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.006);
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
   * Phase 1 (0.5s -> 4.8s): Deep stellar hum and supersonic bolide whistle in space.
   */
  public playSpaceBolideWhistle(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const subOsc = ctx.createOscillator();
    const whistleOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(58, t);
    subOsc.frequency.linearRampToValueAtTime(84, t + 3.4);

    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(920, t);
    whistleOsc.frequency.exponentialRampToValueAtTime(340, t + 3.4);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);

    subOsc.connect(gain);
    whistleOsc.connect(gain);
    gain.connect(dest);

    const record = {
      gain,
      stop: () => {
        try {
          subOsc.stop();
          whistleOsc.stop();
        } catch {
          // Ignore if already stopped
        }
      },
    };
    this.activeCinematicNodes.push(record);

    subOsc.onended = () => {
      subOsc.disconnect();
      whistleOsc.disconnect();
      gain.disconnect();
    };

    subOsc.start(t);
    whistleOsc.start(t);
    subOsc.stop(t + 3.55);
    whistleOsc.stop(t + 3.55);
  }

  /**
   * Phase 2 (4.8s -> 8.5s): Igneous atmospheric re-entry roar, plasma turbulence & sonic wind.
   */
  public playMeteorAtmosphericEntry(heatRatio = 0.8): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const nowMs = performance.now();
    if (nowMs - this.lastReentryPulseAt < 2800) return;
    this.lastReentryPulseAt = nowMs;

    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.getPinkNoiseBuffer(ctx);
    noiseSrc.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, t);
    filter.frequency.exponentialRampToValueAtTime(
      1400 + heatRatio * 600,
      t + 2.4
    );
    filter.frequency.exponentialRampToValueAtTime(380, t + 3.6);
    filter.Q.value = 2.8;

    const rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(52, t);
    rumbleOsc.frequency.linearRampToValueAtTime(78, t + 2.5);
    rumbleOsc.frequency.linearRampToValueAtTime(45, t + 3.6);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.65);
    gain.gain.setValueAtTime(0.28, t + 2.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.65);

    noiseSrc.connect(filter);
    rumbleOsc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    const record = {
      gain,
      stop: () => {
        try {
          noiseSrc.stop();
          rumbleOsc.stop();
        } catch {
          // Ignore
        }
      },
    };
    this.activeCinematicNodes.push(record);

    noiseSrc.onended = () => {
      noiseSrc.disconnect();
      rumbleOsc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    noiseSrc.start(t);
    rumbleOsc.start(t);
    noiseSrc.stop(t + 3.7);
    rumbleOsc.stop(t + 3.7);
  }

  /**
   * Phase 3 (8.5s): Massive ocean splash & underwater cavitation bubble column.
   */
  public playOceanImpact(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // 1. Deep hydrodynamic sub-bass impact thud
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.65);

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.linearRampToValueAtTime(0.38, t + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);

    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.onended = () => {
      subOsc.disconnect();
      subGain.disconnect();
    };
    subOsc.start(t);
    subOsc.stop(t + 0.72);

    // 2. Filtered water splash & underwater cavitation stream
    const splashNoise = ctx.createBufferSource();
    splashNoise.buffer = this.getWhiteNoiseBuffer(ctx);
    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(1100, t);
    splashFilter.frequency.exponentialRampToValueAtTime(240, t + 1.6);
    splashFilter.Q.value = 1.6;

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.001, t);
    splashGain.gain.linearRampToValueAtTime(0.32, t + 0.03);
    splashGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.65);

    splashNoise.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(dest);
    splashNoise.onended = () => {
      splashNoise.disconnect();
      splashFilter.disconnect();
      splashGain.disconnect();
    };
    splashNoise.start(t);
    splashNoise.stop(t + 1.7);

    // 3. Ascending underwater bubble pops
    const bubbleFreqs = [320, 460, 580, 740, 890];
    bubbleFreqs.forEach((bf, i) => {
      const bOsc = ctx.createOscillator();
      const bGain = ctx.createGain();
      const start = t + 0.18 + i * 0.16;
      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bf * 0.7, start);
      bOsc.frequency.exponentialRampToValueAtTime(bf * 1.35, start + 0.09);

      bGain.gain.setValueAtTime(0.001, start);
      bGain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      bGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);

      bOsc.connect(bGain);
      bGain.connect(dest);
      bOsc.onended = () => {
        bOsc.disconnect();
        bGain.disconnect();
      };
      bOsc.start(start);
      bOsc.stop(start + 0.12);
    });
  }

  /**
   * Phase 4 (11.2s): Mineral basalt fracture & bioluminescent cell hatching chord on the seabed.
   */
  public playMeteorCrackOpen(): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.01) return;
    const ctx = this.getContext();
    const dest = this.getSfxDestination();
    if (!ctx || !dest) return;

    const t = ctx.currentTime;

    // 1. Tectonic mineral crack snap
    const crackOsc = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crackOsc.type = 'sawtooth';
    crackOsc.frequency.setValueAtTime(280, t);
    crackOsc.frequency.exponentialRampToValueAtTime(52, t + 0.32);

    crackGain.gain.setValueAtTime(0.001, t);
    crackGain.gain.linearRampToValueAtTime(0.28, t + 0.01);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);

    crackOsc.connect(crackGain);
    crackGain.connect(dest);
    crackOsc.onended = () => {
      crackOsc.disconnect();
      crackGain.disconnect();
    };
    crackOsc.start(t);
    crackOsc.stop(t + 0.35);

    // 2. Bioluminescent genesis emergence arpeggio
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t + 0.08 + idx * 0.075;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.75);

      osc.connect(gain);
      gain.connect(dest);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      osc.start(start);
      osc.stop(start + 0.78);
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
   * Smoothly transitions the procedural background soundtrack to the target state.
   */
  public transitionMusicTo(nextState: AdaptiveMusicState): void {
    if (this.currentMusicState === nextState) return;
    this.currentMusicState = nextState;
    this.musicStepIndex = 0;

    if (nextState === 'none') {
      this.stopMusicScheduler();
      this.stopOceanCurrentDrone();
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    if (nextState === 'ocean') {
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
    const dest = this.getMusicDestination();
    if (!ctx || !dest || this.oceanCurrentSource) return;

    try {
      const src = ctx.createBufferSource();
      src.buffer = this.getPinkNoiseBuffer(ctx);
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 185;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.setTargetAtTime(0.11, ctx.currentTime, 0.6);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start();

      this.oceanCurrentSource = src;
      this.oceanCurrentGain = gain;
    } catch {
      // Ignore if context not ready
    }
  }

  private stopOceanCurrentDrone(): void {
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
      this.oceanCurrentGain = null;
    }
  }

  private startMusicScheduler(): void {
    if (typeof window === 'undefined' || this.musicSchedulerId !== null) return;
    // 220ms tick (~136 BPM eighth-note grid) handles all 4 adaptive states cleanly
    this.musicSchedulerId = window.setInterval(() => {
      this.tickAdaptiveMusicStep();
    }, 220);
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

    const dest = this.getMusicDestination();
    if (!dest) return;

    const step = this.musicStepIndex++;
    const t = this.ctx.currentTime;

    switch (this.currentMusicState) {
      case 'menu': {
        // Canal A (Menú Principal / Sistema Solar): Acordes espaciales etéreos y lentos
        // (ondas sine + filtro LowPass 400Hz + envolvente de ataque largo + LFO de paneo)
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
            this.scheduleEtherealPadNote(freq, t + idx * 0.18, 3.2, 0.042, dest);
          });
        }
        break;
      }

      case 'ocean': {
        // Canal B (Océano Tranquilo / Exploración Celular): Melodía alegre, curiosa y burbujeante
        // en escala pentatónica (C4, D4, E4, G4, A4, C5, D5, E5) con timbre de xilófono de agua / marimba suave
        const pentatonic = [
          261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25,
        ];
        // Play a cheerful marimba droplet on most steps with organic rhythm
        if (step % 2 === 0 || step % 7 === 3) {
          const patternIdx =
            (step * 3 + Math.floor(step / 8)) % pentatonic.length;
          const noteFreq = pentatonic[patternIdx];
          this.scheduleWaterMarimbaNote(noteFreq, t, 0.36, 0.065, dest);
        }
        // Soft warm bass root every 8 steps
        if (step % 8 === 0) {
          const bassRoots = [130.81, 146.83, 164.81, 196.0];
          const root = bassRoots[Math.floor(step / 8) % bassRoots.length];
          this.scheduleWaterMarimbaNote(root, t, 0.95, 0.055, dest);
        }
        break;
      }

      case 'combat': {
        // Canal C (Peligro / Persecución Activa): Pulso rítmico urgente a ~136 BPM
        // con bajo sintetizado sawtooth filtrado y percusión sorda de tensión
        const bassPattern = [65.41, 65.41, 73.42, 65.41, 82.41, 77.78, 65.41, 98.0];
        const bassFreq = bassPattern[step % bassPattern.length];
        this.scheduleCombatPulseNote(bassFreq, t, 0.19, 0.085, dest);

        // Urgent high tension ostinato every 2 steps
        if (step % 2 === 1) {
          const tensionNotes = [261.63, 277.18, 311.13, 293.66];
          const tf = tensionNotes[step % tensionNotes.length];
          this.scheduleWaterMarimbaNote(tf, t, 0.16, 0.048, dest);
        }
        break;
      }

      case 'editor': {
        // Canal D (Taller Evolutivo 3D): Música minimalista, cálida y relajada de laboratorio/creación
        // con acordes mayores suaves y notas cristalinas espaciadas
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
            this.scheduleEtherealPadNote(f, t + idx * 0.08, 1.8, 0.038, dest);
          });
        }
        if (step % 4 === 2) {
          const bellNotes = [523.25, 659.25, 783.99, 880.0, 1046.5];
          const bf = bellNotes[(step / 2) % bellNotes.length];
          this.scheduleWaterMarimbaNote(bf, t, 0.48, 0.042, dest);
        }
        break;
      }
    }
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

  private scheduleCombatPulseNote(
    freq: number,
    startTime: number,
    duration: number,
    peakGain: number,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, startTime);
    filter.frequency.exponentialRampToValueAtTime(140, startTime + duration);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}

export const audioManager = new AudioManager();
