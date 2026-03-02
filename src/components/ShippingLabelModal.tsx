import { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import logoEtiqueta from '@/assets/logo-etiqueta.png';

interface ShippingLabelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    customer_name?: string;
    customer_email?: string;
    shipping_address?: {
      address?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      recipient_name?: string;
    } | null;
    tracking_code?: string;
    shipping_carrier?: string;
    items?: any;
  } | null;
}

const ShippingLabelModal = ({ open, onOpenChange, order }: ShippingLabelProps) => {
  const labelRef = useRef<HTMLDivElement>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      setLogoBase64(canvas.toDataURL('image/png'));
    };
    img.src = logoEtiqueta;
  }, []);

  if (!order) return null;

  const addr = order.shipping_address || {} as any;
  const recipientName = addr.recipient_name || order.customer_name || '—';
  const addressLine = [addr.address, addr.number].filter(Boolean).join(', ');
  const complementLine = addr.complement || '';
  const neighborhoodLine = addr.neighborhood || '';
  const cityStateLine = [addr.city, addr.state].filter(Boolean).join(' - ');
  const zipCode = addr.zip_code || '';

  const handlePrint = () => {
    const content = labelRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - Pedido ${order.id.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 0; }
          @page { size: 100mm 150mm; margin: 4mm; }
          .label-container {
            width: 100%;
            border: 2px solid #000;
            padding: 12px;
            page-break-inside: avoid;
          }
          .section { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #999; }
          .section:last-child { border-bottom: none; margin-bottom: 0; }
          .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #666; margin-bottom: 4px; font-weight: bold; }
          .name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
          .address { font-size: 13px; line-height: 1.5; }
          .zip { font-size: 18px; font-weight: bold; letter-spacing: 2px; margin-top: 4px; }
          .order-info { font-size: 11px; color: #333; }
          .order-id { font-family: monospace; font-size: 12px; font-weight: bold; }
          .tracking { font-family: monospace; font-size: 14px; font-weight: bold; letter-spacing: 1px; }
          .items-summary { font-size: 10px; color: #555; margin-top: 4px; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const itemsSummary = (() => {
    try {
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      if (!Array.isArray(items)) return '';
      return items.map((i: any) => `${i.quantity || 1}x ${i.name || i.product_name || 'Produto'}`).join(' | ');
    } catch {
      return '';
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Etiqueta de Envio</DialogTitle>
        </DialogHeader>

        <div ref={labelRef}>
          <div className="label-container" style={{ border: '2px solid #000', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #999' }}>
              <img src={logoBase64 || logoEtiqueta} alt="Fio de Gala" style={{ height: '40px', margin: '0 auto' }} />
            </div>
            {/* Destinatário */}
            <div className="section" style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px dashed #999' }}>
              <div className="section-title" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                Destinatário
              </div>
              <div className="name" style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '2px' }}>
                {recipientName}
              </div>
              <div className="address" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                {addressLine && <div>{addressLine}</div>}
                {complementLine && <div>{complementLine}</div>}
                {neighborhoodLine && <div>{neighborhoodLine}</div>}
                {cityStateLine && <div>{cityStateLine}</div>}
              </div>
              {zipCode && (
                <div className="zip" style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', marginTop: '4px' }}>
                  CEP: {zipCode}
                </div>
              )}
            </div>

            {/* Pedido */}
            <div className="section" style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px dashed #999' }}>
              <div className="section-title" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                Pedido
              </div>
              <div className="order-id" style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold' }}>
                #{order.id.slice(0, 8).toUpperCase()}
              </div>
              {order.tracking_code && (
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#666' }}>Rastreio: </span>
                  <span className="tracking" style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>
                    {order.tracking_code}
                  </span>
                </div>
              )}
              {order.shipping_carrier && (
                <div style={{ fontSize: '11px', color: '#333', marginTop: '2px' }}>
                  Transportadora: {order.shipping_carrier}
                </div>
              )}
            </div>

            {/* Itens */}
            {itemsSummary && (
              <div className="section">
                <div className="section-title" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                  Conteúdo
                </div>
                <div className="items-summary" style={{ fontSize: '10px', color: '#555' }}>
                  {itemsSummary}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Imprimir Etiqueta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShippingLabelModal;
