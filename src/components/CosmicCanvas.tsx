import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  alphaSpeed: number;
  originalAlpha: number;
  layer: number; // For parallax depth
}

interface Comet {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number; // radians
  alpha: number;
  trail: { x: number; y: number; alpha: number }[];
  active: boolean;
}

export const CosmicCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current.targetX = (e.clientX / width - 0.5) * 30;
      mousePosRef.current.targetY = (e.clientY / height - 0.5) * 30;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Initialize 160 twinkling stars
    const starCount = 160;
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      const baseAlpha = 0.2 + Math.random() * 0.7;
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.5 + 0.5,
        alpha: baseAlpha,
        originalAlpha: baseAlpha,
        alphaSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
        layer: Math.random() * 2 + 1,
      });
    }

    // Initialize Comet/Shooting Star state
    let activeComet: Comet | null = null;
    let nextCometTime = Date.now() + Math.random() * 8000 + 4000; // First comet in 4-12s

    const spawnComet = () => {
      const startX = Math.random() * width * 0.8;
      const startY = Math.random() * height * 0.3;
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3; // ~45 degrees diagonal

      activeComet = {
        x: startX,
        y: startY,
        length: Math.random() * 120 + 80,
        speed: Math.random() * 12 + 10,
        angle,
        alpha: 1.0,
        trail: [],
        active: true,
      };

      nextCometTime = Date.now() + Math.random() * 15000 + 10000; // Next in 10-25s
    };

    // Render loop
    const render = () => {
      // Smooth mouse parallax interpolation
      mousePosRef.current.x += (mousePosRef.current.targetX - mousePosRef.current.x) * 0.05;
      mousePosRef.current.y += (mousePosRef.current.targetY - mousePosRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Render Deep Cosmic Background Radial Glow
      const bgGrad = ctx.createRadialGradient(
        width / 2 + mousePosRef.current.x * 2,
        height / 2 + mousePosRef.current.y * 2,
        50,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.5, '#05070c');
      bgGrad.addColorStop(1, '#020306');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Stars with Twinkle and Parallax Drift
      for (const s of stars) {
        s.alpha += s.alphaSpeed;
        if (s.alpha > 0.95 || s.alpha < 0.15) {
          s.alphaSpeed = -s.alphaSpeed;
        }

        const parallaxX = (s.x + mousePosRef.current.x * s.layer + width) % width;
        const parallaxY = (s.y + mousePosRef.current.y * s.layer + height) % height;

        ctx.beginPath();
        ctx.arc(parallaxX, parallaxY, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
        ctx.fill();

        // Subtle star glow for brighter stars
        if (s.alpha > 0.7 && s.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(parallaxX, parallaxY, s.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${s.alpha * 0.15})`;
          ctx.fill();
        }
      }

      // Check Comet spawn
      if (!activeComet && Date.now() > nextCometTime) {
        spawnComet();
      }

      // Render Comet & Tail
      if (activeComet && activeComet.active) {
        const vx = Math.cos(activeComet.angle) * activeComet.speed;
        const vy = Math.sin(activeComet.angle) * activeComet.speed;

        activeComet.x += vx;
        activeComet.y += vy;

        activeComet.trail.unshift({
          x: activeComet.x,
          y: activeComet.y,
          alpha: activeComet.alpha,
        });

        if (activeComet.trail.length > 25) {
          activeComet.trail.pop();
        }

        // Draw glowing comet trail
        for (let i = 0; i < activeComet.trail.length; i++) {
          const pt = activeComet.trail[i];
          const segmentAlpha = (1 - i / activeComet.trail.length) * pt.alpha;
          const radius = Math.max(0.5, (1 - i / activeComet.trail.length) * 2.5);

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(129, 140, 248, ${segmentAlpha * 0.8})`;
          ctx.fill();
        }

        // Comet Head with bright cyan/white core
        ctx.beginPath();
        ctx.arc(activeComet.x, activeComet.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Check boundary
        if (activeComet.x > width + 100 || activeComet.y > height + 100) {
          activeComet = null;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80"
    />
  );
};
