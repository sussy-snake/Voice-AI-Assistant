export interface VadConfig {
  sampleRate?: number;
  fftSize?: number;
  energyThreshold?: number; // 0.005 to 0.05
  speechHangoverMs?: number; // ms to keep listening after silence
  minSpeechDurationMs?: number; // minimum speech duration
}

export class VadService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isSpeaking = false;
  private speechStartTime = 0;
  private lastSpeechTime = 0;
  private checkInterval: number | null = null;

  public onSpeechStart?: () => void;
  public onSpeechEnd?: (durationMs: number) => void;
  public onVolumeUpdate?: (volume: number) => void;
  public onPcmChunk?: (chunk: Float32Array) => void;

  private config: Required<VadConfig>;

  constructor(config?: VadConfig) {
    this.config = {
      sampleRate: config?.sampleRate ?? 16000,
      fftSize: config?.fftSize ?? 512,
      energyThreshold: config?.energyThreshold ?? 0.015,
      speechHangoverMs: config?.speechHangoverMs ?? 600,
      minSpeechDurationMs: config?.minSpeechDurationMs ?? 250,
    };
  }

  public setSensitivity(threshold: number) {
    this.config.energyThreshold = threshold;
  }

  public async start(stream?: MediaStream): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.stop();
    }

    this.mediaStream = stream || (await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: this.config.sampleRate,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }));

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: this.config.sampleRate,
    });

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = 0.2;

    // Buffer processing
    this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.scriptProcessor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      this.processAudioFrame(inputData);
    };

    source.connect(this.analyser);
    this.analyser.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);

    // Heartbeat check for hangover expiration
    this.checkInterval = window.setInterval(() => {
      this.checkSilenceTimeout();
    }, 50);
  }

  private processAudioFrame(samples: Float32Array) {
    // 1. Calculate RMS energy
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);

    // Normalize volume for visualizer (0.0 to 1.0)
    const normalizedVol = Math.min(1.0, rms * 5.0);
    this.onVolumeUpdate?.(normalizedVol);

    // Broadcast PCM chunk for streaming STT
    this.onPcmChunk?.(samples);

    const now = Date.now();
    const isAboveThreshold = rms > this.config.energyThreshold;

    if (isAboveThreshold) {
      this.lastSpeechTime = now;
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.speechStartTime = now;
        this.onSpeechStart?.();
      }
    }
  }

  private checkSilenceTimeout() {
    if (!this.isSpeaking) return;

    const now = Date.now();
    const silenceDuration = now - this.lastSpeechTime;

    if (silenceDuration > this.config.speechHangoverMs) {
      const speechDuration = now - this.speechStartTime;
      this.isSpeaking = false;
      if (speechDuration >= this.config.minSpeechDurationMs) {
        this.onSpeechEnd?.(speechDuration);
      }
    }
  }

  public async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.isSpeaking = false;
    this.onVolumeUpdate?.(0);
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
