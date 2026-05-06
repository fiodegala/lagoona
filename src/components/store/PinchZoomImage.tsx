import { useRef, useState, useCallback, PointerEvent as RPE } from 'react';

interface Props {
  src: string;
  alt: string;
}

interface Pointer { id: number; x: number; y: number; }

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 300;

const PinchZoomImage = ({ src, alt }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Pointer[]>([]);
  const lastDistRef = useRef<number>(0);
  const lastTapRef = useRef<number>(0);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const reset = useCallback(() => {
    setScale(1); setTx(0); setTy(0);
  }, []);

  const onPointerDown = (e: RPE<HTMLDivElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
    if (pointersRef.current.length === 1) {
      // Detect double tap
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_MS) {
        if (scale > 1) reset();
        else setScale(2.5);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
      lastPanRef.current = { x: e.clientX, y: e.clientY };
    } else if (pointersRef.current.length === 2) {
      const [a, b] = pointersRef.current;
      lastDistRef.current = Math.hypot(b.x - a.x, b.y - a.y);
    }
  };

  const onPointerMove = (e: RPE<HTMLDivElement>) => {
    const ps = pointersRef.current;
    const idx = ps.findIndex(p => p.id === e.pointerId);
    if (idx === -1) return;
    ps[idx] = { id: e.pointerId, x: e.clientX, y: e.clientY };

    if (ps.length === 2) {
      const [a, b] = ps;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (lastDistRef.current > 0) {
        const factor = dist / lastDistRef.current;
        setScale(s => clamp(s * factor));
      }
      lastDistRef.current = dist;
    } else if (ps.length === 1 && scale > 1 && lastPanRef.current) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      setTx(t => t + dx);
      setTy(t => t + dy);
    }
  };

  const onPointerUp = (e: RPE<HTMLDivElement>) => {
    pointersRef.current = pointersRef.current.filter(p => p.id !== e.pointerId);
    if (pointersRef.current.length < 2) lastDistRef.current = 0;
    if (pointersRef.current.length === 0) {
      lastPanRef.current = null;
      if (scale <= 1.05) reset();
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => (scale > 1 ? reset() : setScale(2.5))}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-full object-contain will-change-transform select-none"
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transition: pointersRef.current.length === 0 ? 'transform 0.2s ease-out' : 'none',
        }}
      />
    </div>
  );
};

export default PinchZoomImage;
