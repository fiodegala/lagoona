import { useEffect, useMemo } from 'react';

/**
 * Tema visual de Dia dos Pais para toda a loja.
 * - Gravatas e bigodes flutuando ao fundo
 * - Glow âmbar/azul-marinho nos cantos
 * - Classe global `fathers-day-theme` no <html>
 */
const ITEMS = Array.from({ length: 16 });

const FathersDayTheme = () => {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('fathers-day-theme');
    return () => root.classList.remove('fathers-day-theme');
  }, []);

  const items = useMemo(
    () =>
      ITEMS.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 12;
        const duration = 16 + Math.random() * 14;
        const size = 18 + Math.random() * 28;
        const opacity = 0.25 + Math.random() * 0.4;
        const drift = Math.random() > 0.5 ? 1 : -1;
        const kind = i % 2 === 0 ? 'tie' : 'mustache';
        return { i, left, delay, duration, size, opacity, drift, kind };
      }),
    []
  );

  return (
    <>
      {/* Glow âmbar / azul-marinho nos cantos */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        style={{ mixBlendMode: 'multiply' as const }}
      >
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-slate-800/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-900/25 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-72 w-72 rounded-full bg-amber-700/20 blur-3xl" />
      </div>

      {/* Gravatas e bigodes flutuando */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[2] overflow-hidden">
        {items.map((it) => (
          <svg
            key={it.i}
            viewBox="0 0 24 24"
            className="valentines-heart absolute"
            style={{
              left: `${it.left}%`,
              bottom: `-${it.size + 20}px`,
              width: it.size,
              height: it.size,
              opacity: it.opacity,
              animationDelay: `${it.delay}s`,
              animationDuration: `${it.duration}s`,
              ['--drift' as never]: `${it.drift * (40 + Math.random() * 80)}px`,
            }}
          >
            {it.kind === 'tie' ? (
              <>
                {/* Gravata */}
                <path d="M9 2 h6 l-1 3 l2 2 l-4 15 l-4 -15 l2 -2 z" fill="#7f1d1d" stroke="#1f2937" strokeWidth="0.6" />
                <path d="M10 5 h4 l-0.5 2 h-3 z" fill="#111827" />
              </>
            ) : (
              <>
                {/* Bigode */}
                <path
                  d="M2 12 C 4 8, 8 8, 10 11 C 11 12, 13 12, 14 11 C 16 8, 20 8, 22 12 C 20 15, 16 15, 14 13 C 13 14, 11 14, 10 13 C 8 15, 4 15, 2 12 Z"
                  fill="#1f2937"
                />
              </>
            )}
          </svg>
        ))}
      </div>
    </>
  );
};

export default FathersDayTheme;
