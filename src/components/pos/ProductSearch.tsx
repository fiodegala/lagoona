import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Barcode, X, Loader2 } from 'lucide-react';
import { barcodeService, BarcodeResult } from '@/services/barcodeService';
import { offlineService } from '@/services/offlineService';
import { posService } from '@/services/posService';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface ProductResult {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category_name: string | null;
  image_url: string | null;
  barcode: string | null;
  variations: Array<{
    id: string;
    sku: string | null;
    price: number | null;
    stock: number;
    is_active: boolean;
  }>;
}

interface ProductSearchProps {
  onProductSelect: (product: ProductResult, variationId?: string) => void;
  isOnline: boolean;
}

const ProductSearch = ({ onProductSelect, isOnline }: ProductSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const searchProducts = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      let products: ProductResult[];
      
      if (isOnline) {
        const data = await posService.searchProducts(searchQuery);
        products = data.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          stock: p.stock,
          category_name: null,
          image_url: p.image_url,
          barcode: p.barcode,
          variations: (p.product_variations || []).map((v: Record<string, unknown>) => ({
            id: v.id as string,
            sku: v.sku as string | null,
            price: v.price as number | null,
            stock: v.stock as number,
            is_active: v.is_active as boolean,
          })),
        }));
      } else {
        const cached = await offlineService.searchCachedProducts(searchQuery);
        products = cached;
      }
      
      setResults(products);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  const handleBarcodeScanned = useCallback(async (result: BarcodeResult) => {
    setIsLoading(true);
    try {
      let product: ProductResult | undefined;
      
      if (isOnline) {
        const data = await posService.getProductByBarcode(result.code);
        if (data) {
          product = {
            id: data.id,
            name: data.name,
            description: data.description,
            price: data.price,
            stock: data.stock,
            category_name: null,
            image_url: data.image_url,
            barcode: data.barcode,
            variations: (data.product_variations || []).map((v: Record<string, unknown>) => ({
              id: v.id as string,
              sku: v.sku as string | null,
              price: v.price as number | null,
              stock: v.stock as number,
              is_active: v.is_active as boolean,
            })),
          };
        }
      } else {
        product = await offlineService.getCachedProductByBarcode(result.code);
      }
      
      if (product) {
        onProductSelect(product);
        setQuery('');
        setShowResults(false);
        toast({
          title: 'Produto adicionado',
          description: product.name,
        });
      } else {
        toast({
          title: 'Produto não encontrado',
          description: `Código: ${result.code}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Barcode lookup error:', error);
      toast({
        title: 'Erro ao buscar produto',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, onProductSelect, toast]);

  useEffect(() => {
    const unsubscribe = barcodeService.subscribe(handleBarcodeScanned);
    return unsubscribe;
  }, [handleBarcodeScanned]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchProducts(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, searchProducts]);

  const handleProductClick = (product: ProductResult) => {
    onProductSelect(product);
    setQuery('');
    setShowResults(false);
    inputRef.current?.focus();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="relative">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar produto por nome ou código de barras..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setShowResults(true)}
            className="pl-10 pr-10 h-12 text-lg"
            data-barcode-input
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => {
                setQuery('');
                setResults([]);
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-12 w-12">
          <Barcode className="h-5 w-5" />
        </Button>
      </div>

      {/* Results dropdown */}
      {showResults && (query || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
          {isLoading ? (
            <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Buscando...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="py-1">
              {results.map((product) => (
                <button
                  key={product.id}
                  className={cn(
                    'w-full px-4 py-3 flex items-center gap-4 hover:bg-accent text-left',
                    product.stock <= 0 && 'opacity-50'
                  )}
                  onClick={() => handleProductClick(product)}
                  disabled={product.stock <= 0}
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-12 w-12 object-cover rounded"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                      Sem foto
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{product.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      {product.barcode && (
                        <span className="font-mono">{product.barcode}</span>
                      )}
                      {product.category_name && (
                        <span>• {product.category_name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {formatCurrency(product.price)}
                    </div>
                    <div className={cn(
                      'text-sm',
                      product.stock <= 0 
                        ? 'text-destructive' 
                        : product.stock <= 5 
                          ? 'text-orange-500' 
                          : 'text-muted-foreground'
                    )}>
                      {product.stock <= 0 ? 'Sem estoque' : `${product.stock} em estoque`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-4 text-center text-muted-foreground">
              Nenhum produto encontrado
            </div>
          ) : null}
        </div>
      )}

      {/* Click outside to close */}
      {showResults && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  );
};

export default ProductSearch;
