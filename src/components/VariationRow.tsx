import { useState, useEffect, useRef } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
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
    field: 'price' | 'wholesale_price' | 'exclusive_price' | 'stock' | 'sku' | 'barcode' | 'is_active' | 'image_url',
    value: string | number | boolean
  ) => Promise<void>;
  onUpdateStoreStock: (variationId: string, storeId: string, quantity: number) => Promise<void>;
  onDelete: (variationId: string) => Promise<void>;
}

const VariationRow = ({ variation, stores, storeStock, onUpdate, onUpdateStoreStock, onDelete }: VariationRowProps) => {
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState(variation.image_url || '');
  const [localBarcode, setLocalBarcode] = useState(variation.barcode || '');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local barcode with prop
  useEffect(() => {
    setLocalBarcode(variation.barcode || '');
  }, [variation.barcode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);

  const handleBarcodeChange = (value: string) => {
    setLocalBarcode(value);
    
    // Clear existing timeout
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }
    
    // Debounce: save after 500ms of no typing (barcode scanners type fast then stop)
    barcodeTimeoutRef.current = setTimeout(() => {
      if (value !== variation.barcode) {
        onUpdate(variation.id, 'barcode', value);
      }
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
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'bg-muted/50' : ''}>
      <TableCell className="w-10">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {/* Image thumbnail */}
          <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="relative h-10 w-10 rounded-md border border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden hover:border-primary transition-colors group"
              >
                {variation.image_url ? (
                  <>
                    <img
                      src={variation.image_url}
                      alt="Variação"
                      className="h-full w-full object-cover"
                    />
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remover Imagem
                  </Button>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLocalImageUrl(variation.image_url || '');
                      setIsImageDialogOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleImageSave}>
                    Salvar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Attribute values */}
          <div className="flex flex-wrap gap-1">
            {variation.attribute_values?.map((av, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {av.value}
              </Badge>
            ))}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={variation.sku || ''}
          onChange={(e) => onUpdate(variation.id, 'sku', e.target.value)}
          placeholder="SKU"
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          value={localBarcode}
          onChange={(e) => handleBarcodeChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Save immediately on Enter (barcode scanner finished)
              if (barcodeTimeoutRef.current) {
                clearTimeout(barcodeTimeoutRef.current);
              }
              if (localBarcode !== variation.barcode) {
                onUpdate(variation.id, 'barcode', localBarcode);
              }
              e.currentTarget.blur();
            }
          }}
          onBlur={() => {
            // Save on blur if changed
            if (barcodeTimeoutRef.current) {
              clearTimeout(barcodeTimeoutRef.current);
            }
            if (localBarcode !== variation.barcode) {
              onUpdate(variation.id, 'barcode', localBarcode);
            }
          }}
          placeholder="Código"
          className="h-8 w-28"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={variation.price ?? ''}
          onChange={(e) =>
            onUpdate(variation.id, 'price', parseFloat(e.target.value) || 0)
          }
          placeholder="Varejo"
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={variation.wholesale_price ?? ''}
          onChange={(e) =>
            onUpdate(variation.id, 'wholesale_price', parseFloat(e.target.value) || 0)
          }
          placeholder="Atacado"
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={variation.exclusive_price ?? ''}
          onChange={(e) =>
            onUpdate(variation.id, 'exclusive_price', parseFloat(e.target.value) || 0)
          }
          placeholder="Exclusivo"
          className="h-8 w-24"
        />
      </TableCell>
      {stores.map((store) => (
        <TableCell key={store.id}>
          <Input
            type="number"
            value={storeStock[store.id] ?? 0}
            onChange={(e) =>
              onUpdateStoreStock(variation.id, store.id, parseInt(e.target.value) || 0)
            }
            className="h-8 w-20"
          />
        </TableCell>
      ))}
      <TableCell>
        <Switch
          checked={variation.is_active}
          onCheckedChange={(checked) =>
            onUpdate(variation.id, 'is_active', checked)
          }
        />
      </TableCell>
      <TableCell>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover variação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(variation.id)}
                className="bg-destructive text-destructive-foreground"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
};

export default VariationRow;
