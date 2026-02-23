import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Gift, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { couponsService, Coupon } from '@/services/coupons';
import { toast } from 'sonner';

const WHEEL_COLORS = [
  'hsl(40 60% 50%)',    // gold
  'hsl(220 20% 15%)',   // dark
  'hsl(0 72% 50%)',     // red
  'hsl(220 15% 25%)',   // charcoal
  'hsl(40 45% 60%)',    // champagne
  'hsl(220 20% 10%)',   // rich black
  'hsl(173 80% 40%)',   // teal
  'hsl(250 75% 55%)',   // purple
];

const STORAGE_KEY = 'lagoona_wheel_spun';
const POPUP_DELAY = 5000;

const SpinWheel = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [wonCoupon, setWonCoupon] = useState<Coupon | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const alreadySpun = localStorage.getItem(STORAGE_KEY);
    if (alreadySpun) {
      setHasSpun(true);
      return;
    }

    const loadCoupons = async () => {
      try {
        const all = await couponsService.getAll();
        const active = all.filter(c => {
          if (!c.is_active) return false;
          const now = new Date();
          if (c.starts_at && new Date(c.starts_at) > now) return false;
          if (c.expires_at && new Date(c.expires_at) < now) return false;
          if (c.max_uses && c.uses_count >= c.max_uses) return false;
          return true;
        });
        if (active.length >= 2) {
          setCoupons(active.slice(0, 8));
        }
      } catch (err) {
        console.error('Error loading coupons for wheel:', err);
      }
    };
    loadCoupons();
  }, []);

  // Auto-open popup
  useEffect(() => {
    if (hasSpun || coupons.length < 2) return;
    const timer = setTimeout(() => setIsOpen(true), POPUP_DELAY);
    return () => clearTimeout(timer);
  }, [coupons, hasSpun]);

  // Draw wheel
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || coupons.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 4;
    const sliceAngle = (2 * Math.PI) / coupons.length;

    ctx.clearRect(0, 0, size, size);

    coupons.forEach((coupon, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      // Slice
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(10, Math.min(14, 160 / coupons.length))}px Montserrat, sans-serif`;

      const label = coupon.discount_type === 'percentage'
        ? `${coupon.discount_value}% OFF`
        : `R$${coupon.discount_value.toFixed(0)} OFF`;

      ctx.fillText(label, radius - 16, 5);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(center, center, 24, 0, 2 * Math.PI);
    ctx.fillStyle = 'hsl(40 60% 50%)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GIRE', center, center);
  }, [coupons]);

  useEffect(() => {
    drawWheel();
  }, [drawWheel]);

  const spin = () => {
    if (isSpinning || coupons.length === 0) return;
    setIsSpinning(true);

    const winIndex = Math.floor(Math.random() * coupons.length);
    const sliceAngle = 360 / coupons.length;

    // Calculate target rotation: land in the middle of the winning slice
    // The pointer is at the top (12 o'clock = 270deg in canvas coords)
    const targetSliceCenter = winIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 360 * (5 + Math.floor(Math.random() * 3));
    // We want the pointer (top) to land on the target, so we rotate clockwise
    const finalRotation = extraSpins + (360 - targetSliceCenter);

    setRotation(prev => prev + finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setWonCoupon(coupons[winIndex]);
      setHasSpun(true);
      localStorage.setItem(STORAGE_KEY, 'true');
    }, 4500);
  };

  const copyCode = () => {
    if (!wonCoupon) return;
    navigator.clipboard.writeText(wonCoupon.code);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (coupons.length < 2 || hasSpun && !isOpen) return null;

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && !hasSpun && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed left-4 bottom-24 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl animate-bounce"
          style={{ background: 'hsl(40 60% 50%)' }}
          aria-label="Girar roleta de cupons"
        >
          <Gift className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'hsl(220 20% 8%)' }}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>

            <div className="p-6 text-center">
              <h2
                className="text-2xl font-display font-bold italic mb-1"
                style={{ color: 'hsl(40 60% 50%)' }}
              >
                Tente sua sorte!
              </h2>
              <p className="text-white/60 text-sm mb-6">
                Gire a roleta e ganhe um cupom de desconto exclusivo
              </p>

              {!wonCoupon ? (
                <>
                  {/* Wheel container */}
                  <div className="relative mx-auto" style={{ width: 280, height: 280 }}>
                    {/* Pointer */}
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10"
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: '12px solid transparent',
                        borderRight: '12px solid transparent',
                        borderTop: '20px solid hsl(40 60% 50%)',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      }}
                    />

                    {/* Spinning wheel */}
                    <div
                      className="w-full h-full"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: isSpinning
                          ? 'transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                          : 'none',
                      }}
                    >
                      <canvas
                        ref={canvasRef}
                        width={280}
                        height={280}
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={spin}
                    disabled={isSpinning}
                    className="mt-6 px-8 font-semibold text-base tracking-wide"
                    style={{
                      background: 'hsl(40 60% 50%)',
                      color: 'hsl(220 20% 8%)',
                    }}
                    size="lg"
                  >
                    {isSpinning ? 'Girando...' : 'Girar Roleta'}
                  </Button>
                </>
              ) : (
                /* Won state */
                <div className="py-4 space-y-4 animate-scale-in">
                  <div className="text-6xl mb-2">🎉</div>
                  <h3 className="text-xl font-bold text-white">Parabéns!</h3>
                  <p className="text-white/70 text-sm">Você ganhou um cupom de desconto:</p>

                  <div
                    className="inline-flex items-center gap-3 px-6 py-3 rounded-lg border-2 border-dashed"
                    style={{ borderColor: 'hsl(40 60% 50%)', background: 'hsl(40 60% 50% / 0.1)' }}
                  >
                    <span
                      className="font-mono text-2xl font-bold tracking-wider"
                      style={{ color: 'hsl(40 60% 50%)' }}
                    >
                      {wonCoupon.code}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    >
                      {copied ? (
                        <Check className="h-5 w-5 text-green-400" />
                      ) : (
                        <Copy className="h-5 w-5 text-white/60" />
                      )}
                    </button>
                  </div>

                  <p className="text-white/50 text-xs">
                    {wonCoupon.discount_type === 'percentage'
                      ? `${wonCoupon.discount_value}% de desconto`
                      : `R$ ${wonCoupon.discount_value.toFixed(2)} de desconto`}
                    {wonCoupon.minimum_order_value > 0 &&
                      ` • Mínimo R$ ${wonCoupon.minimum_order_value.toFixed(2)}`}
                  </p>

                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="outline"
                    className="mt-4 border-white/20 text-white hover:bg-white/10"
                  >
                    Continuar comprando
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SpinWheel;
