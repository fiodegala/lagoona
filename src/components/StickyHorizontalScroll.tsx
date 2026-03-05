import { useRef, useEffect, useState, useCallback } from 'react';

interface StickyHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

const StickyHorizontalScroll = ({ children, className = '' }: StickyHorizontalScrollProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fakeBarRef = useRef<HTMLDivElement>(null);
  const fakeInnerRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const syncing = useRef(false);
  const uid = useRef(`shsc-${Math.random().toString(36).slice(2, 8)}`);

  const syncSizes = useCallback(() => {
    const content = contentRef.current;
    const wrapper = wrapperRef.current;
    if (!content || !wrapper) return;

    // Measure actual scrollable width
    const innerW = content.scrollWidth;
    const wrapperW = wrapper.clientWidth;

    setContentWidth(innerW);
    setContainerWidth(wrapperW);

    if (fakeInnerRef.current) {
      fakeInnerRef.current.style.width = `${innerW}px`;
    }
  }, []);

  useEffect(() => {
    // Small delay to ensure DOM is painted
    const timer = setTimeout(syncSizes, 100);
    const obs = new ResizeObserver(syncSizes);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    if (contentRef.current) obs.observe(contentRef.current);
    const mutObs = new MutationObserver(() => setTimeout(syncSizes, 50));
    if (contentRef.current) {
      mutObs.observe(contentRef.current, { childList: true, subtree: true });
    }
    window.addEventListener('resize', syncSizes);
    return () => {
      clearTimeout(timer);
      obs.disconnect();
      mutObs.disconnect();
      window.removeEventListener('resize', syncSizes);
    };
  }, [syncSizes]);

  const hasOverflow = contentWidth > containerWidth + 1;

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
    <div ref={wrapperRef} className="relative">
      {/* Hide native horizontal scrollbar via scoped style */}
      <style>{`
        #${uid.current}::-webkit-scrollbar:horizontal {
          height: 0px;
          display: none;
        }
        #${uid.current} {
          scrollbar-width: none;
        }
      `}</style>

      {/* Scrollable content - native h-scrollbar hidden */}
      <div
        id={uid.current}
        ref={contentRef}
        onScroll={handleContentScroll}
        className={`overflow-x-auto ${className}`}
      >
        {children}
      </div>

      {/* Sticky fake horizontal scrollbar */}
      {hasOverflow && (
        <div
          ref={fakeBarRef}
          onScroll={handleFakeScroll}
          className="sticky bottom-0 z-20 overflow-x-auto scrollbar-always-visible"
          style={{
            height: 14,
            background: 'hsl(var(--background) / 0.85)',
            backdropFilter: 'blur(4px)',
            borderTop: '1px solid hsl(var(--border))',
          }}
        >
          <div ref={fakeInnerRef} style={{ height: 1, width: contentWidth }} />
        </div>
      )}
    </div>
  );
};

export default StickyHorizontalScroll;
