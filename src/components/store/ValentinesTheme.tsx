import { useEffect, useMemo } from 'react';
import { useValentinesPromo } from '@/hooks/useValentinesPromo';

/**
 * Tema visual de Dia dos Namorados para toda a loja.
 * Ativa-se automaticamente quando a promo está ativa em store_config.
 *
 * - Corações flutuando ao fundo (não interativos)
 * - Glow rosado nos cantos
 * - Classe global `valentines-theme` no <html> para tweaks pontuais (ex.: botões)
 */
const HEARTS = Array.from({ length: 18 });

const ValentinesTheme = () => {
  const { active } = useValentinesPromo();

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.classList.add('valentines-theme');
    else root.classList.remove('valentines-theme');
    return () => root.classList.remove('valentines-theme');
  }, [active]);

  const hearts = useMemo(
    () =>
      HEARTS.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 12;
        const duration = 14 + Math.random() * 14;
        const size = 14 + Math.random() * 26;
        const opacity = 0.25 + Math.random() * 0.45;
        const drift = Math.random() > 0.5 ? 1 : -1;
        return { i, left, delay, duration, size, opacity, drift };
      }),
    []
  );

  if (!active) return null;

  return (
    <>
      {/* Glow overlays nos cantos */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
        style={{ mixBlendMode: 'multiply' as const }}
      >
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-rose-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-pink-400/20 blur-3xl" />
      </div>

      {/* Corações flutuando */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[2] overflow-hidden"
      >
        {hearts.map((h) => (
          <svg
            key={h.i}
            viewBox="0 0 24 24"
            className="valentines-heart absolute text-rose-500"
            style={{
              left: `${h.left}%`,
              bottom: `-${h.size + 20}px`,
              width: h.size,
              height: h.size,
              opacity: h.opacity,
              animationDelay: `${h.delay}s`,
              animationDuration: `${h.duration}s`,
              ['--drift' as never]: `${h.drift * (40 + Math.random() * 80)}px`,
            }}
            fill="currentColor"
          >
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.1 3.1 4.5 6.6 4.5c2 0 3.6 1.1 4.4 2.6.8-1.5 2.4-2.6 4.4-2.6 3.5 0 5.7 3.6 4.2 7.3C19.5 16.4 12 21 12 21z" />
          </svg>
        ))}
      </div>
    </>
  );
};

export default ValentinesTheme;
