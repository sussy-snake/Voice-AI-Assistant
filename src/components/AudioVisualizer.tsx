import React, { useEffect, useState } from 'react';
import { Mic, Activity } from 'lucide-react';

interface AudioVisualizerProps {
  volume: number; // 0.0 to 1.0
  isListening: boolean;
  isSpeaking: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  volume,
  isListening,
  isSpeaking,
}) => {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (isListening || isSpeaking) {
      const interval = setInterval(() => {
        setPulse((p) => (p + 1) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isListening, isSpeaking]);

  const bars = 24;
  const clampedVol = Math.min(1.0, Math.max(0.05, volume));

  return (
    <div className="relative rounded-2xl bg-slate-950/70 border border-surfaceBorder/80 p-2.5 flex items-center justify-between overflow-hidden shadow-inner backdrop-blur-md">
      {/* Animated Background Glowing Aura */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-500"
        style={{
          background: isListening
            ? `radial-gradient(circle at 50% 50%, rgba(239, 68, 68, ${0.15 + clampedVol * 0.25}), transparent 70%)`
            : isSpeaking
            ? `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, ${0.15 + clampedVol * 0.25}), transparent 70%)`
            : `radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05), transparent 70%)`,
        }}
      />

      {/* Left Voice Orb Indicator */}
      <div className="flex items-center space-x-2.5 z-10">
        <div className="relative flex items-center justify-center">
          {/* Pulsing Outer Rings */}
          {(isListening || isSpeaking) && (
            <>
              <div
                className={`absolute w-7 h-7 rounded-full animate-ping opacity-30 ${
                  isListening ? 'bg-red-500' : 'bg-accent-cyan'
                }`}
                style={{ animationDuration: '1.4s' }}
              />
              <div
                className={`absolute w-9 h-9 rounded-full opacity-20 border ${
                  isListening ? 'border-red-400' : 'border-cyan-400'
                }`}
                style={{
                  transform: `scale(${1 + clampedVol * 0.6})`,
                  transition: 'transform 0.1s ease-out',
                }}
              />
            </>
          )}

          {/* Central Glowing Core */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
              isListening
                ? 'bg-gradient-to-tr from-red-600 to-rose-400 shadow-red-500/50 scale-105'
                : isSpeaking
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-cyan-500/50 scale-105 animate-pulse'
                : 'bg-slate-800 border border-slate-700 text-slate-400'
            }`}
          >
            {isListening ? (
              <Mic className="w-3.5 h-3.5 text-white animate-bounce" />
            ) : isSpeaking ? (
              <Activity className="w-3.5 h-3.5 text-white animate-spin" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-slate-600" />
            )}
          </div>
        </div>

        {/* State Label */}
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold tracking-wide text-slate-200">
            {isListening ? 'Live Listening...' : isSpeaking ? 'Synthesizing...' : 'Voice Standby'}
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            {isListening ? 'Streaming Silero VAD' : isSpeaking ? 'Local TTS Audio' : 'Hold Space / Tap Mic'}
          </span>
        </div>
      </div>

      {/* Right Cyberpunk Audio Equalizer Bars */}
      <div className="flex items-center space-x-0.5 sm:space-x-1 h-6 z-10">
        {Array.from({ length: bars }).map((_, i) => {
          // Compute pseudo-random organic frequency wave based on volume and index
          const offset = Math.sin((i / bars) * Math.PI * 2 + pulse * 0.1);
          const heightPercent = isListening || isSpeaking
            ? Math.max(15, Math.min(100, clampedVol * 100 * (0.4 + Math.abs(offset) * 0.8)))
            : 10 + (i % 3) * 5;

          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isListening
                  ? 'bg-gradient-to-t from-red-600 via-rose-500 to-amber-400'
                  : isSpeaking
                  ? 'bg-gradient-to-t from-cyan-600 via-blue-500 to-indigo-400'
                  : 'bg-slate-800'
              }`}
              style={{
                height: `${heightPercent}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
