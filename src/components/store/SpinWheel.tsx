import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Gift, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { couponsService, Coupon } from '@/services/coupons';
import { toast } from 'sonner';

const WHEEL_COLORS = [
  '#2d3a4a',   // dark navy
  '#c94c4c',   // warm red
  '#d4a843',   // golden yellow
  '#1e2b3a',   // deep navy
  '#6fa8c7',   // sky blue
  '#2e8b57',   // green
  '#8c8c8c',   // gray
  '#3b5068',   // steel blue
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
        // Check if wheel is enabled
        const { data: configData } = await import('@/integrations/supabase/client').then(m =>
          m.supabase.from('store_config').select('value').eq('key', 'spin_wheel_enabled').maybeSingle()
        );
        if (configData && configData.value === false) return;

        const all = await couponsService.getAll();
        const active = all.filter(c => {
          if (!c.is_active || !c.show_in_wheel) return false;
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

  useEffect(() => {
    if (hasSpun || coupons.length < 2) return;
    const timer = setTimeout(() => setIsOpen(true), POPUP_DELAY);
    return () => clearTimeout(timer);
  }, [coupons, hasSpun]);

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || coupons.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const sliceAngle = (2 * Math.PI) / coupons.length;

    ctx.clearRect(0, 0, size, size);

    // Outer dashed border ring
    ctx.beginPath();
    ctx.arc(center, center, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

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

      // Thin separator line
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(
        center + radius * Math.cos(startAngle),
        center + radius * Math.sin(startAngle)
      );
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(11, Math.min(15, 160 / coupons.length))}px Montserrat, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;

      const label = coupon.discount_type === 'percentage'
        ? `${coupon.discount_value}% OFF`
        : coupon.description?.toLowerCase().includes('frete')
          ? 'Frete Grátis'
          : `R$${coupon.discount_value.toFixed(0)} OFF`;

      ctx.fillText(label, radius - 18, 5);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Center circle - outer ring (gold)
    ctx.beginPath();
    ctx.arc(center, center, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#d4a843';
    ctx.fill();

    // Center circle - inner (dark)
    ctx.beginPath();
    ctx.arc(center, center, 25, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e2b3a';
    ctx.fill();
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gift icon in center
    ctx.fillStyle = '#d4a843';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', center, center);
  }, [coupons]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => drawWheel(), 50);
      return () => clearTimeout(t);
    }
  }, [drawWheel, isOpen]);

  const spin = () => {
    if (isSpinning || coupons.length === 0) return;
    setIsSpinning(true);

    const winIndex = Math.floor(Math.random() * coupons.length);
    const sliceAngle = 360 / coupons.length;
    const targetSliceCenter = winIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 360 * (5 + Math.floor(Math.random() * 3));
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
          style={{ background: '#5a7d99' }}
          aria-label="Girar roleta de cupons"
        >
          <Gift className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white">
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/5 hover:bg-black/10 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>

            <div className="p-6 pt-8 text-center">
              {/* Icon badge */}
              <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#5a7d99' }}>
                <span className="text-2xl">✨</span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                🎰 Gire e Ganhe!
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Gire a roleta e ganhe um desconto exclusivo!
              </p>

              {!wonCoupon ? (
                <>
                  {/* Wheel container */}
                  <div className="relative mx-auto" style={{ width: 300, height: 300 }}>
                    {/* Pointer */}
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: '14px solid transparent',
                        borderRight: '14px solid transparent',
                        borderTop: '24px solid #d4a843',
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                        marginTop: '-2px',
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
                        width={300}
                        height={300}
                        className="w-full h-full"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={spin}
                    disabled={isSpinning}
                    className="mt-6 w-full max-w-xs mx-auto font-bold text-base tracking-wide h-12 rounded-xl text-white"
                    style={{ background: '#3b5068' }}
                    size="lg"
                  >
                    {isSpinning ? 'Girando...' : '🎰 Girar Roleta'}
                  </Button>

                  <p className="text-gray-400 text-xs mt-3">
                    Cupom válido para uma única compra. Não cumulativo com outras promoções.
                  </p>
                </>
              ) : (
                /* Won state */
                <div className="py-4 space-y-4 animate-scale-in">
                  <div className="text-6xl mb-2">🎉</div>
                  <h3 className="text-xl font-bold text-gray-900">Parabéns!</h3>
                  <p className="text-gray-500 text-sm">Você ganhou um cupom de desconto:</p>

                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg border-2 border-dashed border-amber-500 bg-amber-50">
                    <span className="font-mono text-2xl font-bold tracking-wider text-amber-700">
                      {wonCoupon.code}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-1.5 rounded hover:bg-amber-100 transition-colors"
                    >
                      {copied ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <Copy className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </div>

                  <p className="text-gray-400 text-xs">
                    {wonCoupon.discount_type === 'percentage'
                      ? `${wonCoupon.discount_value}% de desconto`
                      : `R$ ${wonCoupon.discount_value.toFixed(2)} de desconto`}
                    {wonCoupon.minimum_order_value > 0 &&
                      ` • Mínimo R$ ${wonCoupon.minimum_order_value.toFixed(2)}`}
                  </p>

                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="outline"
                    className="mt-4"
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
