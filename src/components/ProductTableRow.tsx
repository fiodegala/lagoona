import { useState, useEffect } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Package, Pencil, Trash2, Eye, Power, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { Product } from '@/services/products';
import { variationsService, ProductVariation } from '@/services/variations';

interface ProductTableRowProps {
  product: Product;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  getCategoryName: (categoryId: string | null) => string | null;
  formatCurrency: (value: number) => string;
  highlightBarcode?: string;
}

const ProductTableRow = ({
  product,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onToggleActive,
  getCategoryName,
  formatCurrency,
  highlightBarcode = '',
}: ProductTableRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [variationCount, setVariationCount] = useState<number | null>(null);
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);

  // Load variation count on mount
  useEffect(() => {
    const loadVariationCount = async () => {
      try {
        const vars = await variationsService.getVariationsByProduct(product.id);
        setVariationCount(vars.length);
        setVariations(vars);
      } catch (error) {
        console.error('Error loading variation count:', error);
        setVariationCount(0);
      }
    };
    loadVariationCount();
  }, [product.id]);

  const hasVariations = variationCount !== null && variationCount > 0;
  
  // Check if any variation matches the barcode search
  const hasMatchingBarcode = highlightBarcode && variations.some(v => 
    v.barcode?.toLowerCase().includes(highlightBarcode.toLowerCase())
  );

  // Auto-expand when there's a matching barcode in variations
  useEffect(() => {
    if (hasMatchingBarcode && !isExpanded) {
      setIsExpanded(true);
    }
  }, [hasMatchingBarcode]);

  const handleExpandToggle = async () => {
    if (!isExpanded && variations.length === 0) {
      setIsLoadingVariations(true);
      try {
        const vars = await variationsService.getVariationsByProduct(product.id);
        setVariations(vars);
      } catch (error) {
        console.error('Error loading variations:', error);
      } finally {
        setIsLoadingVariations(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const totalVariationStock = variations.reduce((sum, v) => sum + v.stock, 0);
  const priceRange = variations.length > 0 
    ? {
        min: Math.min(...variations.map(v => v.price ?? product.price)),
        max: Math.max(...variations.map(v => v.price ?? product.price)),
      }
    : null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} asChild>
      <>
        <TableRow className={isSelected ? 'bg-primary/5' : ''}>
          <TableCell>
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelect}
              aria-label={`Selecionar ${product.name}`}
            />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-3">
              {hasVariations && (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleExpandToggle}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{product.name}</p>
                  {hasVariations && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Layers className="h-3 w-3" />
                      {variationCount} var.
                    </Badge>
                  )}
                </div>
                {product.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {product.description}
                  </p>
                )}
              </div>
            </div>
          </TableCell>
          <TableCell>
            {getCategoryName(product.category_id) ? (
              <Badge variant="outline">{getCategoryName(product.category_id)}</Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </TableCell>
          <TableCell className="font-medium">
            {hasVariations && priceRange && priceRange.min !== priceRange.max ? (
              <span className="text-sm">
                {formatCurrency(priceRange.min)} - {formatCurrency(priceRange.max)}
              </span>
            ) : (
              formatCurrency(product.price)
            )}
          </TableCell>
          <TableCell>
            {hasVariations ? (
              <Badge
                variant={totalVariationStock > 0 ? 'secondary' : 'destructive'}
                className={totalVariationStock > 0 ? '' : 'bg-destructive/10 text-destructive'}
              >
                {totalVariationStock} un. (total)
              </Badge>
            ) : (
              <Badge
                variant={product.stock > 0 ? 'secondary' : 'destructive'}
                className={product.stock > 0 ? '' : 'bg-destructive/10 text-destructive'}
              >
                {product.stock} un.
              </Badge>
            )}
          </TableCell>
          <TableCell>
            {product.is_active ? (
              <Badge className="bg-success/10 text-success hover:bg-success/20">
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary">Inativo</Badge>
            )}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onView}
                title="Visualizar"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${product.is_active ? 'text-success hover:text-success' : 'text-muted-foreground'}`}
                onClick={onToggleActive}
                title={product.is_active ? 'Desativar' : 'Ativar'}
              >
                <Power className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onEdit}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O produto "{product.name}" será removido permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={onDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TableCell>
        </TableRow>
        
        {/* Expanded Variations */}
        <CollapsibleContent asChild>
          <>
            {variations.map((variation) => {
              const isHighlighted = highlightBarcode && 
                variation.barcode?.toLowerCase().includes(highlightBarcode.toLowerCase());
              
              return (
              <TableRow 
                key={variation.id} 
                className={`hover:bg-muted/50 ${
                  isHighlighted 
                    ? 'bg-primary/10 ring-2 ring-primary/30 ring-inset' 
                    : 'bg-muted/30'
                }`}
              >
                <TableCell></TableCell>
                <TableCell>
                  <div className="flex items-center gap-3 pl-10">
                    {variation.image_url ? (
                      <img
                        src={variation.image_url}
                        alt="Variação"
                        className={`h-8 w-8 rounded-md object-cover ${isHighlighted ? 'ring-2 ring-primary' : ''}`}
                      />
                    ) : (
                      <div className={`h-8 w-8 rounded-md bg-muted flex items-center justify-center ${isHighlighted ? 'ring-2 ring-primary' : ''}`}>
                        <Layers className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {variation.attribute_values?.map((av, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {av.attribute_name}: {av.value}
                        </Badge>
                      ))}
                      {isHighlighted && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                          Código encontrado
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {variation.sku && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {variation.sku}
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {formatCurrency(variation.price ?? product.price)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={variation.stock > 0 ? 'secondary' : 'destructive'}
                    className={`text-xs ${variation.stock > 0 ? '' : 'bg-destructive/10 text-destructive'}`}
                  >
                    {variation.stock} un.
                  </Badge>
                </TableCell>
                <TableCell>
                  {variation.is_active ? (
                    <Badge className="bg-success/10 text-success hover:bg-success/20 text-xs">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
              );
            })}
          </>
        </CollapsibleContent>
      </>
    </Collapsible>
  );
};

export default ProductTableRow;
