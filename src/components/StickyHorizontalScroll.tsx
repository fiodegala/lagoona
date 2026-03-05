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

  const syncSizes = useCallback(() => {
    const content = contentRef.current;
    const wrapper = wrapperRef.current;
    if (!content || !wrapper) return;

    // Measure the actual inner content width
    const inner = content.firstElementChild as HTMLElement;
    const innerW = inner ? inner.scrollWidth : content.scrollWidth;
    const wrapperW = wrapper.clientWidth;

    setContentWidth(innerW);
    setContainerWidth(wrapperW);

    if (fakeInnerRef.current) {
      fakeInnerRef.current.style.width = `${innerW}px`;
    }
  }, []);

  useEffect(() => {
    syncSizes();
    const obs = new ResizeObserver(syncSizes);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    if (contentRef.current) obs.observe(contentRef.current);
    // Also observe mutations for dynamic content
    const mutObs = new MutationObserver(syncSizes);
    if (contentRef.current) {
      mutObs.observe(contentRef.current, { childList: true, subtree: true });
    }
    window.addEventListener('resize', syncSizes);
    return () => {
      obs.disconnect();
      mutObs.disconnect();
      window.removeEventListener('resize', syncSizes);
    };
  }, [syncSizes]);

  const hasOverflow = contentWidth > containerWidth;

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
      {/* Content with horizontal scroll but hidden scrollbar */}
      <div
        ref={contentRef}
        onScroll={handleContentScroll}
        className={`overflow-x-auto ${className}`}
        style={{
          // Hide the native horizontal scrollbar
          scrollbarWidth: 'none',
        }}
      >
        <style>{`
          .sticky-hscroll-content::-webkit-scrollbar:horizontal {
            display: none;
          }
        `}</style>
        <div className="sticky-hscroll-content" style={{ display: 'contents' }}>
          {children}
        </div>
      </div>

      {/* Fake scrollbar that sticks to the bottom of the viewport */}
      {hasOverflow && (
        <div
          ref={fakeBarRef}
          onScroll={handleFakeScroll}
          className="sticky bottom-0 z-20 overflow-x-auto scrollbar-always-visible bg-background/80 backdrop-blur-sm"
          style={{ height: 14 }}
        >
          <div ref={fakeInnerRef} style={{ height: 1, width: contentWidth }} />
        </div>
      )}
    </div>
  );
};

export default StickyHorizontalScroll;
