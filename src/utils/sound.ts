class SoundUtility {
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    
    return this.ctx;
  }

  /**
   * Sound effect for sending a message (text, sticker, voice sticker)
   * A clean, quick, tech-modern "whoosh-pop" style synth sound
   */
  public static playSendMessage(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Fast exponential pitch sweep from 220Hz (A3) up to 880Hz (A5)
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      // Snappy envelope to make it feel responsive and non-intrusive
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn('Failed to play message sound:', e);
    }
  }

  /**
   * Sound effect for initiating/pressing call buttons
   * A pleasant high-tech dual-tone digital chime sequence
   */
  public static playCallInitiate(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      
      // Tone 1: 523.25Hz (C5), nice bell-like triangle wave
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      
      gain1.gain.setValueAtTime(0.0, now);
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Tone 2: 783.99Hz (G5), pure sine wave triggered slightly delayed (50ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.05);

      gain2.gain.setValueAtTime(0.0, now + 0.05);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.06);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);

      osc2.start(now + 0.05);
      osc2.stop(now + 0.28);
    } catch (e) {
      console.warn('Failed to play call sound:', e);
    }
  }
}

export default SoundUtility;
