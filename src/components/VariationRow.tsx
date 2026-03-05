import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2, ImagePlus, X, GripVertical } from 'lucide-react';
import { ProductVariation } from '@/services/variations';
import ImageUpload from './ImageUpload';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface StoreInfo {
  id: string;
  name: string;
  type: string;
}

interface VariationRowProps {
  variation: ProductVariation;
  stores: StoreInfo[];
  storeStock: Record<string, number>;
  onUpdate: (
    variationId: string,
    field: 'price' | 'wholesale_price' | 'exclusive_price' | 'promotional_price' | 'stock' | 'sku' | 'barcode' | 'is_active' | 'image_url',
    value: string | number | boolean
  ) => Promise<void>;
  onUpdateStoreStock: (variationId: string, storeId: string, quantity: number) => Promise<void>;
  onDelete: (variationId: string) => Promise<void>;
}

const VariationRow = ({ variation, stores, storeStock, onUpdate, onUpdateStoreStock, onDelete }: VariationRowProps) => {
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState(variation.image_url || '');
  const [localBarcode, setLocalBarcode] = useState(variation.barcode || '');
  const [localPrice, setLocalPrice] = useState(String(variation.price ?? ''));
  const [localPromoPrice, setLocalPromoPrice] = useState(String((variation as any).promotional_price ?? ''));
  const [localWholesalePrice, setLocalWholesalePrice] = useState(String(variation.wholesale_price ?? ''));
  const [localExclusivePrice, setLocalExclusivePrice] = useState(String(variation.exclusive_price ?? ''));
  const [localSku, setLocalSku] = useState(variation.sku || '');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const debounceRefs = useRef<Record<string, NodeJS.Timeout | null>>({});

  useEffect(() => { setLocalBarcode(variation.barcode || ''); }, [variation.barcode]);
  useEffect(() => { setLocalPrice(String(variation.price ?? '')); }, [variation.price]);
  useEffect(() => { setLocalPromoPrice(String((variation as any).promotional_price ?? '')); }, [(variation as any).promotional_price]);
  useEffect(() => { setLocalWholesalePrice(String(variation.wholesale_price ?? '')); }, [variation.wholesale_price]);
  useEffect(() => { setLocalExclusivePrice(String(variation.exclusive_price ?? '')); }, [variation.exclusive_price]);
  useEffect(() => { setLocalSku(variation.sku || ''); }, [variation.sku]);

  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
      Object.values(debounceRefs.current).forEach(t => t && clearTimeout(t));
    };
  }, []);

  const debouncedUpdate = (key: string, field: Parameters<typeof onUpdate>[1], value: string | number | boolean) => {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]!);
    debounceRefs.current[key] = setTimeout(() => {
      onUpdate(variation.id, field, value);
    }, 600);
  };

  const flushField = (key: string, field: Parameters<typeof onUpdate>[1], localVal: string, propVal: any) => {
    if (debounceRefs.current[key]) clearTimeout(debounceRefs.current[key]!);
    const parsed = parseFloat(localVal) || 0;
    if (String(parsed) !== String(propVal ?? 0)) {
      onUpdate(variation.id, field, parsed);
    }
  };

  const handleBarcodeChange = (value: string) => {
    setLocalBarcode(value);
    if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
    barcodeTimeoutRef.current = setTimeout(() => {
      if (value !== variation.barcode) onUpdate(variation.id, 'barcode', value);
    }, 500);
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: variation.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleImageSave = async () => {
    await onUpdate(variation.id, 'image_url', localImageUrl);
    setIsImageDialogOpen(false);
  };

  const handleRemoveImage = async () => {
    setLocalImageUrl('');
    await onUpdate(variation.id, 'image_url', '');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border ${isDragging ? 'bg-muted/50' : 'bg-card'}`}
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-always-visible p-2">
        {/* Drag handle - fixed */}
        <div className="shrink-0">
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Image + Attributes - fixed */}
        <div className="shrink-0 flex items-center gap-2">
          <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="relative h-10 w-10 rounded-md border border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden hover:border-primary transition-colors group"
              >
                {variation.image_url ? (
                  <>
                    <img src={variation.image_url} alt="Variação" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <ImagePlus className="h-4 w-4 text-white" />
                    </div>
                  </>
                ) : (
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Imagem da Variação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <ImageUpload
                  value={localImageUrl}
                  onChange={(url) => setLocalImageUrl(url || '')}
                  bucket="product-images"
                  folder="variations"
                />
                {localImageUrl && (
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleRemoveImage}>
                    <X className="h-4 w-4 mr-2" />
                    Remover Imagem
                  </Button>
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => { setLocalImageUrl(variation.image_url || ''); setIsImageDialogOpen(false); }}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleImageSave}>Salvar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex flex-wrap gap-1 min-w-[60px]">
            {variation.attribute_values?.map((av, idx) => (
              <Badge key={idx} variant="outline" className="text-xs whitespace-nowrap">
                {av.value}
              </Badge>
            ))}
          </div>
        </div>

        {/* SKU */}
        <div className="shrink-0">
          <Input
            value={localSku}
            onChange={(e) => { setLocalSku(e.target.value); debouncedUpdate('sku', 'sku', e.target.value); }}
            onBlur={() => { if (debounceRefs.current['sku']) clearTimeout(debounceRefs.current['sku']!); if (localSku !== (variation.sku || '')) onUpdate(variation.id, 'sku', localSku); }}
            placeholder="SKU"
            className="h-8 w-24"
          />
        </div>

        {/* Barcode */}
        <div className="shrink-0">
          <Input
            value={localBarcode}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);
                if (localBarcode !== variation.barcode) onUpdate(variation.id, 'barcode', localBarcode);
                e.currentTarget.blur();
              }
            }}
            onBlur={() => { if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current); if (localBarcode !== variation.barcode) onUpdate(variation.id, 'barcode', localBarcode); }}
            placeholder="Código"
            className="h-8 w-28"
          />
        </div>

        {/* Price */}
        <div className="shrink-0">
          <Input
            type="number" step="0.01"
            value={localPrice}
            onChange={(e) => { setLocalPrice(e.target.value); debouncedUpdate('price', 'price', parseFloat(e.target.value) || 0); }}
            onBlur={() => flushField('price', 'price', localPrice, variation.price)}
            placeholder="Varejo"
            className="h-8 w-24"
          />
        </div>

        {/* Promo Price */}
        <div className="shrink-0">
          <Input
            type="number" step="0.01"
            value={localPromoPrice}
            onChange={(e) => { setLocalPromoPrice(e.target.value); debouncedUpdate('promo', 'promotional_price', parseFloat(e.target.value) || 0); }}
            onBlur={() => flushField('promo', 'promotional_price', localPromoPrice, (variation as any).promotional_price)}
            placeholder="Promo"
            className="h-8 w-24 border-store-deal/30"
          />
        </div>

        {/* Wholesale Price */}
        <div className="shrink-0">
          <Input
            type="number" step="0.01"
            value={localWholesalePrice}
            onChange={(e) => { setLocalWholesalePrice(e.target.value); debouncedUpdate('wholesale', 'wholesale_price', parseFloat(e.target.value) || 0); }}
            onBlur={() => flushField('wholesale', 'wholesale_price', localWholesalePrice, variation.wholesale_price)}
            placeholder="Atacado"
            className="h-8 w-24"
          />
        </div>

        {/* Exclusive Price */}
        <div className="shrink-0">
          <Input
            type="number" step="0.01"
            value={localExclusivePrice}
            onChange={(e) => { setLocalExclusivePrice(e.target.value); debouncedUpdate('exclusive', 'exclusive_price', parseFloat(e.target.value) || 0); }}
            onBlur={() => flushField('exclusive', 'exclusive_price', localExclusivePrice, variation.exclusive_price)}
            placeholder="Exclusivo"
            className="h-8 w-24"
          />
        </div>

        {/* Store stocks */}
        {stores.map((store) => (
          <div key={store.id} className="shrink-0">
            <Input
              type="number"
              value={storeStock[store.id] ?? 0}
              onChange={(e) => onUpdateStoreStock(variation.id, store.id, parseInt(e.target.value) || 0)}
              className="h-8 w-20"
              title={store.name}
            />
          </div>
        ))}

        {/* Active switch */}
        <div className="shrink-0 px-2">
          <Switch
            checked={variation.is_active}
            onCheckedChange={(checked) => onUpdate(variation.id, 'is_active', checked)}
          />
        </div>

        {/* Delete */}
        <div className="shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover variação?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(variation.id)} className="bg-destructive text-destructive-foreground">
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};

export default VariationRow;
