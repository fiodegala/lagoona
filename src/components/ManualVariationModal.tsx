import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { ProductAttribute } from '@/services/variations';

interface ManualVariationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: {
    attributeValueIds: string[];
    sku?: string;
    barcode?: string;
    price?: number;
    stock?: number;
  }) => Promise<void>;
  attributes: ProductAttribute[];
  basePrice: number;
}

const ManualVariationModal = ({
  open,
  onClose,
  onConfirm,
  attributes,
  basePrice,
}: ManualVariationModalProps) => {
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({});
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState(basePrice.toString());
  const [stock, setStock] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form when opening
      setSelectedValues({});
      setSku('');
      setBarcode('');
      setPrice(basePrice.toString());
      setStock('0');
    }
  }, [open, basePrice]);

  const handleSubmit = async () => {
    const attributeValueIds = Object.values(selectedValues).filter(Boolean);
    
    if (attributeValueIds.length !== attributes.length) {
      return; // All attributes must have a selected value
    }

    setIsSaving(true);
    try {
      await onConfirm({
        attributeValueIds,
        sku: sku || undefined,
        barcode: barcode || undefined,
        price: parseFloat(price) || undefined,
        stock: parseInt(stock) || 0,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const isFormValid = Object.values(selectedValues).filter(Boolean).length === attributes.length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Variação Manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Attribute selectors */}
          {attributes.map((attr) => (
            <div key={attr.id} className="space-y-2">
              <Label>{attr.name}</Label>
              <Select
                value={selectedValues[attr.id] || ''}
                onValueChange={(value) =>
                  setSelectedValues((prev) => ({ ...prev, [attr.id]: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione ${attr.name.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {attr.values?.map((val) => (
                    <SelectItem key={val.id} value={val.id}>
                      {val.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* Optional fields */}
          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>SKU (opcional)</Label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ex: CAM-AZL-P"
                />
              </div>
              <div className="space-y-2">
                <Label>Código de Barras</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Ex: 7891234567890"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque</Label>
                <Input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              'Adicionar Variação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualVariationModal;
