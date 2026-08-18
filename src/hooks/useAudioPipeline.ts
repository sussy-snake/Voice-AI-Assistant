import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioSettings, AudioState } from '../types';
import { VadService } from '../services/vadService';

interface UseAudioPipelineProps {
  settings: AudioSettings;
  onTranscriptionComplete?: (transcript: string) => void;
}

export function useAudioPipeline({ settings, onTranscriptionComplete }: UseAudioPipelineProps) {
  const [audioState, setAudioState] = useState<AudioState>({
    isListening: false,
    isSpeaking: false,
    volume: 0,
    interimTranscript: '',
    finalTranscript: '',
    error: null,
  });

  const vadServiceRef = useRef<VadService | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');

  // -------------------------------------------------------------
  // Smart Punctuation & Capitalization Formatter
  // -------------------------------------------------------------
  const formatSmartTranscript = useCallback(
    (text: string): string => {
      let formatted = text;

      if (settings.smartPunctuation) {
        formatted = formatted
          .replace(/\b(period|full stop)\b/gi, '.')
          .replace(/\b(comma)\b/gi, ',')
          .replace(/\b(question mark)\b/gi, '?')
          .replace(/\b(exclamation mark|exclamation point)\b/gi, '!')
          .replace(/\b(new line|enter)\b/gi, '\n')
          .replace(/\b(colon)\b/gi, ':')
          .replace(/\b(semicolon)\b/gi, ';');
      }

      if (settings.autoCapitalize) {
        // Capitalize sentence starts
        formatted = formatted.replace(/(^\s*|\.\s+|\?\s+|\!\s+)([a-z])/g, (_, prefix, letter) => {
          return prefix + letter.toUpperCase();
        });
      }

      return formatted.trim();
    },
    [settings.smartPunctuation, settings.autoCapitalize]
  );

  // -------------------------------------------------------------
  // Web Speech API Fallback Initialization
  // -------------------------------------------------------------
  const initWebSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this environment.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcriptPart;
        } else {
          interim += transcriptPart;
        }
      }

      if (final) {
        const formattedFinal = formatSmartTranscript(final);
        accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + formattedFinal;
        setAudioState((prev) => ({
          ...prev,
          finalTranscript: accumulatedTranscriptRef.current,
          interimTranscript: '',
        }));
      } else {
        setAudioState((prev) => ({
          ...prev,
          interimTranscript: formatSmartTranscript(interim),
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setAudioState((prev) => ({ ...prev, error: `Speech error: ${event.error}` }));
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current && settings.voiceMode === 'voice-activated') {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }
    };

    return recognition;
  }, [formatSmartTranscript, settings.voiceMode]);

  // -------------------------------------------------------------
  // Start Audio Pipeline
  // -------------------------------------------------------------
  const startListening = useCallback(async () => {
    try {
      setAudioState((prev) => ({ ...prev, error: null, interimTranscript: '', finalTranscript: '' }));
      accumulatedTranscriptRef.current = '';
      isListeningRef.current = true;

      // 1. Initialize VAD
      if (!vadServiceRef.current) {
        vadServiceRef.current = new VadService({
          energyThreshold: settings.vadSensitivity,
          speechHangoverMs: 700,
        });

        vadServiceRef.current.onSpeechStart = () => {
          setAudioState((prev) => ({ ...prev, isSpeaking: true }));
        };

        vadServiceRef.current.onSpeechEnd = () => {
          setAudioState((prev) => ({ ...prev, isSpeaking: false }));
          if (accumulatedTranscriptRef.current.trim()) {
            onTranscriptionComplete?.(accumulatedTranscriptRef.current.trim());
          }
        };

        vadServiceRef.current.onVolumeUpdate = (vol) => {
          setAudioState((prev) => ({ ...prev, volume: vol }));
        };
      }

      vadServiceRef.current.setSensitivity(settings.vadSensitivity);
      await vadServiceRef.current.start();

      // 2. Start STT
      if (!recognitionRef.current) {
        recognitionRef.current = initWebSpeechRecognition();
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // May already be started
        }
      }

      setAudioState((prev) => ({ ...prev, isListening: true }));
    } catch (err: any) {
      setAudioState((prev) => ({
        ...prev,
        isListening: false,
        error: err.message || 'Microphone access denied',
      }));
    }
  }, [settings.vadSensitivity, initWebSpeechRecognition, onTranscriptionComplete]);

  // -------------------------------------------------------------
  // Stop Audio Pipeline
  // -------------------------------------------------------------
  const stopListening = useCallback(async () => {
    isListeningRef.current = false;

    if (vadServiceRef.current) {
      await vadServiceRef.current.stop();
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const finalResult = accumulatedTranscriptRef.current.trim();
    if (finalResult && onTranscriptionComplete) {
      onTranscriptionComplete(finalResult);
    }

    setAudioState((prev) => ({
      ...prev,
      isListening: false,
      isSpeaking: false,
      volume: 0,
    }));
  }, [onTranscriptionComplete]);

  // -------------------------------------------------------------
  // Push-to-Talk Global Keybinding Handler
  // -------------------------------------------------------------
  useEffect(() => {
    if (settings.voiceMode !== 'push-to-talk') return;

    let isKeyDown = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.code === settings.pushToTalkKey || (settings.pushToTalkKey === 'Space' && e.code === 'Space')) &&
        !isKeyDown &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        isKeyDown = true;
        e.preventDefault();
        startListening();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === settings.pushToTalkKey || (settings.pushToTalkKey === 'Space' && e.code === 'Space')) {
        isKeyDown = false;
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [settings.voiceMode, settings.pushToTalkKey, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadServiceRef.current) {
        vadServiceRef.current.stop();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    audioState,
    startListening,
    stopListening,
    clearTranscript: () => {
      accumulatedTranscriptRef.current = '';
      setAudioState((prev) => ({ ...prev, interimTranscript: '', finalTranscript: '' }));
    },
  };
}
