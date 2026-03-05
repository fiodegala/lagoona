import { useRef, useEffect, useState, useCallback } from 'react';

interface StickyHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
  /** The scrollable ancestor to observe for sticky positioning. If not provided, uses the component's own wrapper. */
  scrollContainerRef?: React.RefObject<HTMLElement>;
}

/**
 * Renders a fixed-position horizontal scrollbar at the bottom of the viewport
 * that syncs with the horizontal scroll of its children.
 * This avoids the problem of sticky not working inside nested overflow containers.
 */
const StickyHorizontalScroll = ({ children, className = '' }: StickyHorizontalScrollProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const fakeBarRef = useRef<HTMLDivElement>(null);
  const fakeInnerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [barStyle, setBarStyle] = useState<React.CSSProperties>({ display: 'none' });
  const syncing = useRef(false);
  const rafId = useRef(0);

  const syncSizes = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;
    setContentWidth(content.scrollWidth);
    setContainerWidth(content.clientWidth);
    if (fakeInnerRef.current) {
      fakeInnerRef.current.style.width = `${content.scrollWidth}px`;
    }
  }, []);

  // Position the fake scrollbar fixed at the bottom of the viewport,
  // aligned horizontally with the content container
  const updateBarPosition = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    const rect = content.getBoundingClientRect();
    const viewportH = window.innerHeight;

    // Only show if the content is at least partially visible and overflows horizontally
    const hasOverflow = content.scrollWidth > content.clientWidth + 1;

    if (!hasOverflow) {
      setBarStyle({ display: 'none' });
      return;
    }

    // Always show fixed at bottom when content overflows horizontally
    setBarStyle({
      position: 'fixed',
      bottom: 0,
      left: rect.left,
      width: rect.width,
      height: 14,
      zIndex: 9999,
      background: 'hsl(var(--background) / 0.9)',
      backdropFilter: 'blur(4px)',
      borderTop: '1px solid hsl(var(--border))',
      display: 'block',
    });
  }, []);

  useEffect(() => {
    syncSizes();
    updateBarPosition();

    const obs = new ResizeObserver(() => {
      syncSizes();
      updateBarPosition();
    });
    if (contentRef.current) obs.observe(contentRef.current);

    // Listen to ALL scroll events (any ancestor) and resize
    const onScrollOrResize = () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(updateBarPosition);
    };

    window.addEventListener('scroll', onScrollOrResize, true); // capture phase catches all scrolls
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      obs.disconnect();
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      cancelAnimationFrame(rafId.current);
    };
  }, [syncSizes, updateBarPosition]);

  const handleContentScroll = () => {
    if (syncing.current) return;
    syncing.current = true;
    if (fakeBarRef.current && contentRef.current) {
      fakeBarRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { syncing.current = false; });
  };

  const handleFakeScroll = () => {
    if (syncing.current) return;
    syncing.current = true;
    if (contentRef.current && fakeBarRef.current) {
      contentRef.current.scrollLeft = fakeBarRef.current.scrollLeft;
    }
    requestAnimationFrame(() => { syncing.current = false; });
  };

  return (
    <>
      {/* Hide native horizontal scrollbar */}
      <style>{`
        .shsc-content::-webkit-scrollbar:horizontal { height: 0; display: none; }
        .shsc-content { scrollbar-width: none; }
      `}</style>

      <div
        ref={contentRef}
        onScroll={(e) => { handleContentScroll(); updateBarPosition(); }}
        className={`shsc-content overflow-x-auto ${className}`}
      >
        {children}
      </div>

      {/* Fixed fake horizontal scrollbar - rendered via portal-like fixed positioning */}
      <div
        ref={fakeBarRef}
        onScroll={handleFakeScroll}
        className="overflow-x-auto scrollbar-always-visible"
        style={barStyle}
      >
        <div ref={fakeInnerRef} style={{ height: 1, width: contentWidth }} />
      </div>
    </>
  );
};

export default StickyHorizontalScroll;
