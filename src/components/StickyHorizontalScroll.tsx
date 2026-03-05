import { useRef, useEffect, useState, useCallback } from 'react';

interface StickyHorizontalScrollProps {
  children: React.ReactNode;
  className?: string;
}

const StickyHorizontalScroll = ({ children, className = '' }: StickyHorizontalScrollProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const fakeBarRef = useRef<HTMLDivElement>(null);
  const fakeInnerRef = useRef<HTMLDivElement>(null);
  const [showFake, setShowFake] = useState(false);
  const syncing = useRef(false);

  const syncSizes = useCallback(() => {
    const content = contentRef.current;
    const fakeInner = fakeInnerRef.current;
    if (!content || !fakeInner) return;

    const hasOverflow = content.scrollWidth > content.clientWidth;
    setShowFake(hasOverflow);
    fakeInner.style.width = `${content.scrollWidth}px`;
  }, []);

  useEffect(() => {
    syncSizes();
    const obs = new ResizeObserver(syncSizes);
    if (contentRef.current) obs.observe(contentRef.current);
    window.addEventListener('resize', syncSizes);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', syncSizes);
    };
  }, [syncSizes]);

  // Sync scroll positions between real content and fake scrollbar
  const handleContentScroll = () => {
    if (syncing.current) return;
    syncing.current = true;
    if (fakeBarRef.current && contentRef.current) {
      fakeBarRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
    syncing.current = false;
  };

  const handleFakeScroll = () => {
    if (syncing.current) return;
    syncing.current = true;
    if (contentRef.current && fakeBarRef.current) {
      contentRef.current.scrollLeft = fakeBarRef.current.scrollLeft;
    }
    syncing.current = false;
  };

  return (
    <div className="relative">
      {/* Real scrollable content - no horizontal scrollbar shown */}
      <div
        ref={contentRef}
        onScroll={handleContentScroll}
        className={`overflow-x-hidden overflow-y-visible ${className}`}
      >
        {children}
      </div>

      {/* Fake sticky scrollbar at bottom of viewport */}
      {showFake && (
        <div
          ref={fakeBarRef}
          onScroll={handleFakeScroll}
          className="sticky bottom-0 z-20 overflow-x-auto scrollbar-always-visible"
          style={{ height: 12 }}
        >
          <div ref={fakeInnerRef} style={{ height: 1 }} />
        </div>
      )}
    </div>
  );
};

export default StickyHorizontalScroll;
