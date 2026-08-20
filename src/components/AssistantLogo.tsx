import React from 'react';

interface AssistantLogoProps {
  size?: number;
  isListening?: boolean;
  isSpeaking?: boolean;
  volume?: number;
}

export const AssistantLogo: React.FC<AssistantLogoProps> = ({
  size = 28,
  isListening = false,
  isSpeaking = false,
  volume = 0,
}) => {
  const clampedVol = Math.min(1.0, Math.max(0.05, volume));
  const scaleOuter = 1 + (isListening || isSpeaking ? clampedVol * 0.4 : 0);
  const scaleMiddle = 1 + (isListening || isSpeaking ? clampedVol * 0.25 : 0);

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: size, height: size }}
    >
      {/* Outer Orbital Ring 1 */}
      <svg
        className={`absolute inset-0 transition-transform duration-150 ${
          isSpeaking ? 'animate-spin' : isListening ? 'animate-pulse' : ''
        }`}
        style={{
          width: size,
          height: size,
          transform: `scale(${scaleOuter})`,
          animationDuration: isSpeaking ? '3s' : '1.5s',
        }}
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#ringGrad1)"
          strokeWidth="2.5"
          strokeDasharray="18 12"
          opacity={isListening ? 0.9 : 0.6}
        />
        <defs>
          <linearGradient id="ringGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
      </svg>

      {/* Middle Orbital Ring 2 */}
      <svg
        className={`absolute inset-0 transition-transform duration-150 ${
          isSpeaking ? 'animate-spin' : ''
        }`}
        style={{
          width: size,
          height: size,
          transform: `scale(${scaleMiddle}) rotate(45deg)`,
          animationDuration: '6s',
          animationDirection: 'reverse',
        }}
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="32"
          fill="none"
          stroke="url(#ringGrad2)"
          strokeWidth="2"
          strokeDasharray="10 8"
          opacity={isSpeaking ? 0.8 : 0.4}
        />
        <defs>
          <linearGradient id="ringGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>

      {/* Iridescent Kinetic Core */}
      <div
        className={`rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
          isListening
            ? 'bg-gradient-to-tr from-rose-500 via-red-500 to-amber-400 shadow-rose-500/60 scale-110'
            : isSpeaking
            ? 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-cyan-500/60 scale-110 animate-pulse'
            : 'bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 shadow-brand-500/40'
        }`}
        style={{
          width: size * 0.46,
          height: size * 0.46,
        }}
      >
        <div
          className="rounded-full bg-white/90"
          style={{ width: size * 0.16, height: size * 0.16 }}
        />
      </div>
    </div>
  );
};
