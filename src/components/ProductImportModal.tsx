import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { productsService, CreateProductData, Category } from '@/services/products';

interface ProductImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: Category[];
}

interface ParsedProduct {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  status: string;
  isValid: boolean;
  errors: string[];
  categoryId?: string;
}

const ProductImportModal = ({ open, onClose, onSuccess, categories }: ProductImportModalProps) => {
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setParsedProducts([]);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const parseCSV = (content: string): ParsedProduct[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      toast.error('O arquivo CSV deve conter cabeçalho e ao menos uma linha de dados');
      return [];
    }

    // Parse header - support both ; and , as separators
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    
    // Map expected headers
    const headerMap: Record<string, number> = {};
    const expectedHeaders = ['nome', 'name', 'descrição', 'descricao', 'description', 'categoria', 'category', 'preço', 'preco', 'price', 'preço (r$)', 'estoque', 'stock', 'status'];
    
    headers.forEach((header, index) => {
      if (header.includes('nome') || header === 'name') headerMap['name'] = index;
      else if (header.includes('descri') || header === 'description') headerMap['description'] = index;
      else if (header.includes('categ') || header === 'category') headerMap['category'] = index;
      else if (header.includes('pre') || header === 'price') headerMap['price'] = index;
      else if (header.includes('estoque') || header === 'stock') headerMap['stock'] = index;
      else if (header.includes('status')) headerMap['status'] = index;
    });

    if (headerMap['name'] === undefined || headerMap['price'] === undefined) {
      toast.error('O CSV deve conter ao menos as colunas: Nome e Preço');
      return [];
    }

    const products: ParsedProduct[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line handling quoted values
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
          values.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/^["']|["']$/g, ''));

      const errors: string[] = [];
      
      const name = values[headerMap['name']] || '';
      const description = headerMap['description'] !== undefined ? values[headerMap['description']] || '' : '';
      const categoryName = headerMap['category'] !== undefined ? values[headerMap['category']] || '' : '';
      const priceStr = headerMap['price'] !== undefined ? values[headerMap['price']] || '0' : '0';
      const stockStr = headerMap['stock'] !== undefined ? values[headerMap['stock']] || '0' : '0';
      const status = headerMap['status'] !== undefined ? values[headerMap['status']] || 'Ativo' : 'Ativo';

      // Validate name
      if (!name || name.length < 2) {
        errors.push('Nome inválido (mín. 2 caracteres)');
      }
      if (name.length > 200) {
        errors.push('Nome muito longo (máx. 200 caracteres)');
      }

      // Parse and validate price
      const priceClean = priceStr.replace(/[R$\s]/g, '').replace(',', '.');
      const price = parseFloat(priceClean);
      if (isNaN(price) || price < 0) {
        errors.push('Preço inválido');
      }

      // Parse and validate stock
      const stock = parseInt(stockStr, 10);
      if (isNaN(stock) || stock < 0) {
        errors.push('Estoque inválido');
      }

      // Find category
      let categoryId: string | undefined;
      if (categoryName) {
        const foundCategory = categories.find(
          c => c.name.toLowerCase() === categoryName.toLowerCase() || 
               c.slug.toLowerCase() === categoryName.toLowerCase()
        );
        if (foundCategory) {
          categoryId = foundCategory.id;
        } else {
          errors.push(`Categoria "${categoryName}" não encontrada`);
        }
      }

      products.push({
        name,
        description,
        category: categoryName,
        price: isNaN(price) ? 0 : price,
        stock: isNaN(stock) ? 0 : stock,
        status,
        isValid: errors.length === 0,
        errors,
        categoryId,
      });
    }

    return products;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV');
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const products = parseCSV(content);
      setParsedProducts(products);
    };
    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const validProducts = parsedProducts.filter(p => p.isValid);
    if (validProducts.length === 0) {
      toast.error('Nenhum produto válido para importar');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const product of validProducts) {
      try {
        const productData: CreateProductData = {
          name: product.name,
          description: product.description || undefined,
          price: product.price,
          stock: product.stock,
          category_id: product.categoryId,
          is_active: product.status.toLowerCase() !== 'inativo',
        };
        await productsService.create(productData);
        successCount++;
      } catch (error) {
        console.error('Error importing product:', product.name, error);
        errorCount++;
      }
    }

    setIsImporting(false);

    if (errorCount === 0) {
      toast.success(`${successCount} produto(s) importado(s) com sucesso!`);
      handleClose();
      onSuccess();
    } else {
      toast.warning(`${successCount} importado(s), ${errorCount} erro(s)`);
      if (successCount > 0) {
        onSuccess();
      }
    }
  };

  const downloadTemplate = () => {
    const templateContent = `Nome;Descrição;Categoria;Preço (R$);Estoque;Status
Produto Exemplo 1;Descrição do produto 1;${categories[0]?.name || 'categoria-exemplo'};29,90;100;Ativo
Produto Exemplo 2;Descrição do produto 2;;49,90;50;Ativo
Produto Exemplo 3;;${categories[0]?.name || ''};99,00;0;Inativo`;

    const blob = new Blob(['\uFEFF' + templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_produtos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Modelo CSV baixado');
  };

  const validCount = parsedProducts.filter(p => p.isValid).length;
  const invalidCount = parsedProducts.filter(p => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Produtos via CSV
          </DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo CSV para importar produtos em lote.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {parsedProducts.length === 0 ? (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  {fileName || 'Clique para selecionar um arquivo CSV'}
                </p>
                <p className="text-sm text-muted-foreground">
                  ou arraste e solte aqui
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Formato esperado:</strong> Nome, Descrição, Categoria, Preço, Estoque, Status.
                  <br />
                  O separador pode ser vírgula (,) ou ponto e vírgula (;).
                </AlertDescription>
              </Alert>

              <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" />
                Baixar modelo CSV
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    {fileName}
                  </Badge>
                  <Badge className="bg-success/10 text-success gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {validCount} válido(s)
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {invalidCount} com erro(s)
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  Selecionar outro arquivo
                </Button>
              </div>

              <ScrollArea className="h-[350px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedProducts.map((product, index) => (
                      <TableRow key={index} className={!product.isValid ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          {product.isValid ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.name || '—'}</TableCell>
                        <TableCell>
                          {product.categoryId ? (
                            <Badge variant="outline">{product.category}</Badge>
                          ) : product.category ? (
                            <span className="text-destructive text-sm">{product.category}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(product.price)}
                        </TableCell>
                        <TableCell>{product.stock}</TableCell>
                        <TableCell>
                          {product.errors.length > 0 ? (
                            <span className="text-sm text-destructive">
                              {product.errors.join(', ')}
                            </span>
                          ) : (
                            <span className="text-success text-sm">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancelar
          </Button>
          {parsedProducts.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || isImporting}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {validCount} produto(s)
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductImportModal;
