import React, { useEffect, useRef } from 'react';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isActive = true;

    const render = () => {
      if (!isActive) return;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const effectiveVol = isSpeaking ? Math.max(0.2, volume) : isListening ? 0.05 : 0;
      phaseRef.current += isSpeaking ? 0.15 : 0.03;

      // Draw Multi-Layered Glowing Waves
      const waves = [
        { amplitude: effectiveVol * 22, frequency: 0.04, color: 'rgba(99, 102, 241, 0.8)', offset: 0 },
        { amplitude: effectiveVol * 16, frequency: 0.06, color: 'rgba(6, 182, 212, 0.7)', offset: Math.PI / 2 },
        { amplitude: effectiveVol * 10, frequency: 0.08, color: 'rgba(168, 85, 247, 0.5)', offset: Math.PI },
      ];

      for (const wave of waves) {
        ctx.beginPath();
        ctx.lineWidth = isSpeaking ? 2.5 : 1.5;
        ctx.strokeStyle = wave.color;

        for (let x = 0; x < width; x++) {
          // Windowing function so ends taper off cleanly
          const envelope = Math.sin((Math.PI * x) / width);
          const y =
            centerY +
            Math.sin(x * wave.frequency + phaseRef.current + wave.offset) *
              wave.amplitude *
              envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [volume, isListening, isSpeaking]);

  return (
    <div className="relative w-full h-10 flex items-center justify-center overflow-hidden bg-slate-950/60 rounded-lg border border-surfaceBorder/60">
      <canvas
        ref={canvasRef}
        width={320}
        height={40}
        className="w-full h-full"
      />
      {!isListening && (
        <div className="absolute text-[11px] font-mono text-slate-500 pointer-events-none">
          Microphone standby
        </div>
      )}
    </div>
  );
};
