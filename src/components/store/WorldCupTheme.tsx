import { useEffect, useMemo } from 'react';

/**
 * Tema visual de Copa do Mundo para toda a loja.
 * - Bolinhas de futebol flutuando ao fundo
 * - Faixas verde/amarelo/azul nos cantos
 * - Classe global `worldcup-theme` no <html>
 */
const BALLS = Array.from({ length: 16 });

const WorldCupTheme = () => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('worldcup-theme');
    return () => root.classList.remove('worldcup-theme');
  }, []);

  const balls = useMemo(
    () =>
      BALLS.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 12;
        const duration = 16 + Math.random() * 14;
        const size = 16 + Math.random() * 28;
        const opacity = 0.25 + Math.random() * 0.4;
        const drift = Math.random() > 0.5 ? 1 : -1;
        return { i, left, delay, duration, size, opacity, drift };
      }),
    []
  );

  return (
    <>
      {/* Faixas verde/amarelo/azul nos cantos */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        style={{ mixBlendMode: 'multiply' as const }}
      >
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-green-600/25 blur-3xl" />
        <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-yellow-400/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-700/25 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-72 w-72 rounded-full bg-green-500/20 blur-3xl" />
      </div>

      {/* Bolas de futebol subindo */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[2] overflow-hidden">
        {balls.map((b) => (
          <svg
            key={b.i}
            viewBox="0 0 24 24"
            className="valentines-heart absolute"
            style={{
              left: `${b.left}%`,
              bottom: `-${b.size + 20}px`,
              width: b.size,
              height: b.size,
              opacity: b.opacity,
              animationDelay: `${b.delay}s`,
              animationDuration: `${b.duration}s`,
              ['--drift' as never]: `${b.drift * (40 + Math.random() * 80)}px`,
            }}
          >
            <circle cx="12" cy="12" r="10" fill="#ffffff" stroke="#0a0a0a" strokeWidth="1.2" />
            <polygon
              points="12,7 15,9.2 13.8,12.8 10.2,12.8 9,9.2"
              fill="#0a0a0a"
            />
            <path
              d="M12 2 L12 7 M22 12 L15 9.2 M19 19 L13.8 12.8 M5 19 L10.2 12.8 M2 12 L9 9.2"
              stroke="#0a0a0a"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        ))}
      </div>
    </>
  );
};

export default WorldCupTheme;
