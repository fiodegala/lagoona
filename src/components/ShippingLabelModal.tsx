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
    total?: number;
    payment_method?: string;
    payment_status?: string;
    metadata?: any;
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

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  boleto: 'Boleto',
  bolbradesco: 'Boleto',
  bank_transfer: 'PIX',
};

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

  const meta = order.metadata || {};
  const paymentTypeId = meta.payment_type_id || '';
  const paymentLabel = (() => {
    if (paymentTypeId) return paymentMethodLabels[paymentTypeId] || paymentTypeId;
    if (order.payment_method) return paymentMethodLabels[order.payment_method] || order.payment_method;
    return '';
  })();

  const items = (() => {
    try {
      const parsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  const sectionTitle: React.CSSProperties = {
    fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px',
    color: '#666', marginBottom: '6px', fontWeight: 'bold',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px dashed #999',
  };

  const handlePrint = () => {
    const content = labelRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - Pedido ${order.id.slice(0, 8)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 0; }
          @page { size: 148mm 210mm; margin: 6mm; }
          .label-container {
            width: 100%;
            border: 2px solid #000;
            padding: 16px;
            page-break-inside: avoid;
          }
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Etiqueta de Envio</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          <div ref={labelRef}>
            <div className="label-container" style={{ border: '2px solid #000', padding: '16px', fontFamily: 'Arial, sans-serif' }}>
              {/* Logo */}
              <div style={{ textAlign: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px dashed #999' }}>
                <img src={logoBase64 || logoEtiqueta} alt="Fio de Gala" style={{ height: '44px', margin: '0 auto' }} />
              </div>

              {/* Destinatário */}
              <div style={sectionStyle}>
                <div style={sectionTitle}>Destinatário</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '2px' }}>
                  {recipientName}
                </div>
                <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                  {addressLine && <div>{addressLine}</div>}
                  {complementLine && <div>{complementLine}</div>}
                  {neighborhoodLine && <div>{neighborhoodLine}</div>}
                  {cityStateLine && <div>{cityStateLine}</div>}
                </div>
                {zipCode && (
                  <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px', marginTop: '4px' }}>
                    CEP: {zipCode}
                  </div>
                )}
              </div>

              {/* Pedido + Pagamento */}
              <div style={sectionStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={sectionTitle}>Pedido</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>
                      #{order.id.slice(0, 8).toUpperCase()}
                    </div>
                    {order.tracking_code && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#666' }}>Rastreio: </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>
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
                  <div style={{ textAlign: 'right' }}>
                    <div style={sectionTitle}>Total</div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                      R$ {Number(order.total || 0).toFixed(2)}
                    </div>
                    {paymentLabel && (
                      <div style={{ fontSize: '11px', color: '#333', marginTop: '2px' }}>
                        {paymentLabel}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itens com imagens */}
              {items.length > 0 && (
                <div style={{ marginBottom: '0' }}>
                  <div style={sectionTitle}>Conteúdo ({items.length} {items.length === 1 ? 'item' : 'itens'})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }}>
                        {(item.image_url || item.imageUrl) && (
                          <img
                            src={item.image_url || item.imageUrl}
                            alt={item.name || 'Produto'}
                            style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #eee', flexShrink: 0 }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name || item.product_name || 'Produto'}
                          </div>
                          {item.variation && (
                            <div style={{ fontSize: '10px', color: '#666' }}>{item.variation}</div>
                          )}
                          {item.sku && (
                            <div style={{ fontSize: '10px', color: '#999' }}>SKU: {item.sku}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold' }}>R$ {Number(item.price || 0).toFixed(2)}</div>
                          <div style={{ fontSize: '10px', color: '#666' }}>Qtd: {item.quantity || 1}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
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
