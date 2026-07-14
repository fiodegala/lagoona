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
      {/* Glow azul-marinho nos cantos */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        style={{ mixBlendMode: 'multiply' as const }}
      >
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-800/25 blur-3xl" />
        <div className="absolute -top-40 right-0 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-900/25 blur-3xl" />
        <div className="absolute -bottom-40 left-10 h-72 w-72 rounded-full bg-sky-700/20 blur-3xl" />
      </div>

    </>
  );
};

export default FathersDayTheme;
