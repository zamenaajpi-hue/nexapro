/**
 * Call Sounds Utility
 * Generates and manages call sounds using Web Audio API
 * Optimized for mobile devices
 */

class CallSoundsManager {
  private audioContext: AudioContext | null = null;
  private isInitialized = false;
  private ringtoneOscillators: OscillatorNode[] = [];
  private acceptanceGainNode: GainNode | null = null;
  private ringtoneGainNode: GainNode | null = null;
  private ringtoneAudio: HTMLAudioElement | null = null;

  /**
   * Initialize Audio Context on user interaction
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const audioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!audioContextClass) {
        console.warn('AudioContext not supported');
        return;
      }

      this.audioContext = new audioContextClass();

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio element for ringtone
      this.ringtoneAudio = new Audio('/sounds/phone-call-ringtone.mp3');
      this.ringtoneAudio.loop = true;
      this.ringtoneAudio.volume = 0.5;

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  /**
   * Play incoming call ringtone from MP3 file or fallback to synthesis
   */
  playIncomingCallRingtone(): void {
    // Try to play MP3 file first
    if (this.ringtoneAudio) {
      try {
        this.ringtoneAudio.currentTime = 0;
        this.ringtoneAudio.play().catch((err) => {
          console.warn('Failed to play MP3 ringtone, using synthesis:', err);
          this.playIncomingCallRingtoneSynthesized();
        });
        return;
      } catch (err) {
        console.warn('Error with MP3 ringtone:', err);
      }
    }

    // Fallback to synthesis
    this.playIncomingCallRingtoneSynthesized();
  }

  /**
   * Synthesized ringtone as fallback
   */
  private playIncomingCallRingtoneSynthesized(): void {
    if (!this.audioContext || this.audioContext.state === 'suspended') {
      console.warn('AudioContext not ready for ringtone');
      return;
    }

    this.stopRingtone();

    const now = this.audioContext.currentTime;
    const duration = 0.5;
    const interval = 1.0;

    this.ringtoneGainNode = this.audioContext.createGain();
    this.ringtoneGainNode.connect(this.audioContext.destination);
    this.ringtoneGainNode.gain.setValueAtTime(0.3, now);

    const createTone = (frequency: number, startTime: number) => {
      const osc = this.audioContext!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      osc.connect(this.ringtoneGainNode!);
      osc.start(startTime);
      osc.stop(startTime + duration);
      this.ringtoneOscillators.push(osc);
    };

    const pattern = [440, 880, 660, 880];
    for (let i = 0; i < 30; i++) {
      const startTime = now + (i % pattern.length) * interval;
      if (startTime < now + 30) {
        createTone(pattern[i % pattern.length], startTime);
      }
    }
  }

  /**
   * Play accepted call sound
   */
  playAcceptedSound(): void {
    if (!this.audioContext) {
      console.warn('AudioContext not initialized');
      return;
    }

    const now = this.audioContext.currentTime;
    this.acceptanceGainNode = this.audioContext.createGain();
    this.acceptanceGainNode.connect(this.audioContext.destination);
    this.acceptanceGainNode.gain.setValueAtTime(0.3, now);

    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(600, now);
    osc1.connect(this.acceptanceGainNode);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, now + 0.3);
    osc2.connect(this.acceptanceGainNode);
    osc2.start(now + 0.3);
    osc2.stop(now + 0.6);
  }

  /**
   * Play call start sound
   */
  playCallStartSound(): void {
    if (!this.audioContext) {
      console.warn('AudioContext not initialized');
      return;
    }

    const now = this.audioContext.currentTime;
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);
    gainNode.gain.setValueAtTime(0.3, now);

    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Play call end sound
   */
  playCallEndSound(): void {
    if (!this.audioContext) {
      console.warn('AudioContext not initialized');
      return;
    }

    const now = this.audioContext.currentTime;
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);
    gainNode.gain.setValueAtTime(0.3, now);

    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Play notification beep
   */
  playNotificationBeep(): void {
    if (!this.audioContext) {
      console.warn('AudioContext not initialized');
      return;
    }

    const now = this.audioContext.currentTime;
    const gainNode = this.audioContext.createGain();
    gainNode.connect(this.audioContext.destination);
    gainNode.gain.setValueAtTime(0.3, now);

    const osc = this.audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Stop ringtone
   */
  stopRingtone(): void {
    // Stop MP3 playback
    if (this.ringtoneAudio) {
      try {
        this.ringtoneAudio.pause();
        this.ringtoneAudio.currentTime = 0;
      } catch (e) {
        // Already stopped
      }
    }

    const now = this.audioContext?.currentTime || 0;

    this.ringtoneOscillators.forEach((osc) => {
      try {
        osc.stop(now);
      } catch (e) {
        // Already stopped
      }
    });
    this.ringtoneOscillators = [];

    if (this.ringtoneGainNode) {
      this.ringtoneGainNode.gain.setValueAtTime(0, now);
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.stopRingtone();
    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.src = '';
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
    }
    this.isInitialized = false;
  }
}

export const callSounds = new CallSoundsManager();
