import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminLayout from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Package, Plus, Trash2, Loader2, Eye, EyeOff, Filter, Search, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Upload, ArrowUpDown, ArrowUp, ArrowDown, ScanBarcode } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { productsService, Product, categoriesService, Category } from '@/services/products';

import ProductFormModal from '@/components/ProductFormModal';
import ProductImportModal from '@/components/ProductImportModal';
import ProductTableRow from '@/components/ProductTableRow';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

type SortField = 'name' | 'price' | 'stock' | null;
type SortDirection = 'asc' | 'desc';

const Products = () => {
  const { canManageProducts } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  const [productVariationBarcodes, setProductVariationBarcodes] = useState<Record<string, string[]>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  const loadData = async () => {
    try {
      const [productsData, categoriesData, variationBarcodes] = await Promise.all([
        productsService.getAll(),
        categoriesService.getAll(),
        // Single query to get ALL variation barcodes at once instead of N+1
        supabase
          .from('product_variations')
          .select('product_id, barcode')
          .not('barcode', 'is', null)
          .neq('barcode', ''),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      
      // Build barcode map from single query result
      const barcodeMap: Record<string, string[]> = {};
      if (variationBarcodes.data) {
        for (const row of variationBarcodes.data) {
          if (row.barcode) {
            if (!barcodeMap[row.product_id]) {
              barcodeMap[row.product_id] = [];
            }
            barcodeMap[row.product_id].push(row.barcode);
          }
        }
      }
      setProductVariationBarcodes(barcodeMap);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products.filter(product => {
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Barcode search - check product barcode and variation barcodes
      const matchesBarcode = barcodeSearch === '' || 
        product.barcode?.toLowerCase().includes(barcodeSearch.toLowerCase()) ||
        productVariationBarcodes[product.id]?.some(b => 
          b.toLowerCase().includes(barcodeSearch.toLowerCase())
        );
      
      const matchesCategory = selectedCategory === 'all' ||
        (selectedCategory === 'none' && !product.category_id) ||
        product.category_id === selectedCategory;

      const matchesStatus = selectedStatus === 'all' ||
        (selectedStatus === 'active' && product.is_active) ||
        (selectedStatus === 'inactive' && !product.is_active);
      
      return matchesSearch && matchesBarcode && matchesCategory && matchesStatus;
    });

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'name':
            comparison = a.name.localeCompare(b.name, 'pt-BR');
            break;
          case 'price':
            comparison = a.price - b.price;
            break;
          case 'stock':
            comparison = a.stock - b.stock;
            break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [products, searchQuery, barcodeSearch, productVariationBarcodes, selectedCategory, selectedStatus, sortField, sortDirection]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, barcodeSearch, selectedCategory, selectedStatus, sortField, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const getVisiblePages = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (currentPage < totalPages - 2) {
      pages.push('ellipsis');
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    const category = categories.find(c => c.id === categoryId);
    return category?.name || null;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction or clear sort
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-primary" />
      : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await productsService.delete(id);
      toast.success('Produto excluído com sucesso');
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir produto');
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      await productsService.toggleActive(product.id, !product.is_active);
      toast.success(product.is_active ? 'Produto desativado' : 'Produto ativado');
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar produto');
    }
  };

  const handleToggleVisibility = async (product: Product, field: 'is_active' | 'visible_in_pos' | 'visible_in_catalog', value: boolean) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ [field]: value } as never)
        .eq('id', product.id);
      if (error) throw error;
      const labels = { is_active: 'Site', visible_in_pos: 'PDV', visible_in_catalog: 'Catálogo' };
      toast.success(`${labels[field]}: ${value ? 'Ativado' : 'Desativado'}`);
      loadData();
    } catch (error) {
      toast.error('Erro ao atualizar visibilidade');
    }
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = paginatedProducts.map(p => p.id);
      setSelectedProducts(new Set(allIds));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const isAllSelected = paginatedProducts.length > 0 && 
    paginatedProducts.every(p => selectedProducts.has(p.id));
  
  const isIndeterminate = selectedProducts.size > 0 && 
    !isAllSelected && 
    paginatedProducts.some(p => selectedProducts.has(p.id));

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsBulkActionLoading(true);
    try {
      const promises = Array.from(selectedProducts).map(id => productsService.delete(id));
      await Promise.all(promises);
      toast.success(`${selectedProducts.size} produto(s) excluído(s)`);
      setSelectedProducts(new Set());
      loadData();
    } catch (error) {
      toast.error('Erro ao excluir produtos');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkActivate = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsBulkActionLoading(true);
    try {
      const promises = Array.from(selectedProducts).map(id => 
        productsService.toggleActive(id, true)
      );
      await Promise.all(promises);
      toast.success(`${selectedProducts.size} produto(s) ativado(s)`);
      setSelectedProducts(new Set());
      loadData();
    } catch (error) {
      toast.error('Erro ao ativar produtos');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedProducts.size === 0) return;
    
    setIsBulkActionLoading(true);
    try {
      const promises = Array.from(selectedProducts).map(id => 
        productsService.toggleActive(id, false)
      );
      await Promise.all(promises);
      toast.success(`${selectedProducts.size} produto(s) desativado(s)`);
      setSelectedProducts(new Set());
      loadData();
    } catch (error) {
      toast.error('Erro ao desativar produtos');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyForExport = (value: number) => {
    return value.toFixed(2).replace('.', ',');
  };

  const getExportData = () => {
    return filteredProducts.map(product => ({
      Nome: product.name,
      Descrição: product.description || '',
      Categoria: getCategoryName(product.category_id) || 'Sem categoria',
      'Preço (R$)': formatCurrencyForExport(product.price),
      Estoque: product.stock,
      Status: product.is_active ? 'Ativo' : 'Inativo',
      'Criado em': new Date(product.created_at).toLocaleDateString('pt-BR'),
      'Atualizado em': new Date(product.updated_at).toLocaleDateString('pt-BR'),
    }));
  };

  const exportToCSV = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum produto para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(';'),
      ...data.map(row => 
        headers.map(header => {
          const value = String(row[header as keyof typeof row] ?? '');
          // Escape quotes and wrap in quotes if contains semicolon or newline
          if (value.includes(';') || value.includes('\n') || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(';')
      )
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${data.length} produto(s) exportado(s) para CSV`);
  };

  const exportToExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      toast.error('Nenhum produto para exportar');
      return;
    }

    const headers = Object.keys(data[0]);
    
    // Create Excel XML format
    const xmlRows = data.map(row => 
      `<Row>${headers.map(header => {
        const value = row[header as keyof typeof row];
        const cellValue = String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const isNumber = header === 'Estoque' || header === 'Preço (R$)';
        return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${isNumber ? String(value).replace(',', '.') : cellValue}</Data></Cell>`;
      }).join('')}</Row>`
    ).join('\n');

    const headerRow = `<Row>${headers.map(h => 
      `<Cell ss:StyleID="header"><Data ss:Type="String">${h}</Data></Cell>`
    ).join('')}</Row>`;

    const excelContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
    </Style>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E0E0E0" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Produtos">
    <Table>
      ${headerRow}
      ${xmlRows}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `produtos_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`${data.length} produto(s) exportado(s) para Excel`);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
            <p className="text-muted-foreground mt-1">Gerencie seu catálogo de produtos</p>
          </div>
          <div className="flex items-center gap-2">
            {canManageProducts && (
              <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2" disabled={filteredProducts.length === 0}>
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canManageProducts && (
              <Button className="gap-2" onClick={handleCreate}>
                <Plus className="h-4 w-4" />
                Novo Produto
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative w-full sm:w-[200px]">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Código de barras..."
              value={barcodeSearch}
              onChange={(e) => setBarcodeSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categories.filter(cat => cat.id).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
            {(selectedCategory !== 'all' || selectedStatus !== 'all' || searchQuery) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSearchQuery('');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Card className="card-elevated">
          {isLoading ? (
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          ) : filteredProducts.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">
                {products.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
              </CardTitle>
              <CardDescription className="text-center mb-4">
                {products.length === 0 
                  ? 'Comece adicionando seu primeiro produto' 
                  : 'Tente ajustar o filtro de categoria'}
              </CardDescription>
              {products.length === 0 ? (
                <Button className="gap-2" onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  Adicionar Produto
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setSelectedCategory('all')}>
                  Limpar filtro
                </Button>
              )}
            </CardContent>
          ) : (
            <CardContent className="p-0">
              {/* Bulk Actions Bar */}
              {selectedProducts.size > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b">
                  <span className="text-sm font-medium">
                    {selectedProducts.size} produto(s) selecionado(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkActivate}
                      disabled={isBulkActionLoading}
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Ativar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDeactivate}
                      disabled={isBulkActionLoading}
                      className="gap-1"
                    >
                      <EyeOff className="h-4 w-4" />
                      Desativar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isBulkActionLoading}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir produtos?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Você está prestes a excluir {selectedProducts.size} produto(s). Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleBulkDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir {selectedProducts.size} produto(s)
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProducts(new Set())}
                    >
                      Limpar seleção
                    </Button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          // @ts-ignore - indeterminate prop
                          indeterminate={isIndeterminate}
                          onCheckedChange={handleSelectAll}
                          aria-label="Selecionar todos"
                        />
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Produto
                          {getSortIcon('name')}
                        </div>
                      </TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('price')}
                      >
                        <div className="flex items-center gap-2">
                          Preço
                          {getSortIcon('price')}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('stock')}
                      >
                        <div className="flex items-center gap-2">
                          Estoque
                          {getSortIcon('stock')}
                        </div>
                      </TableHead>
                      <TableHead>Visibilidade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <ProductTableRow
                        key={product.id}
                        product={product}
                        isSelected={selectedProducts.has(product.id)}
                        onSelect={(checked) => handleSelectProduct(product.id, checked)}
                        onView={() => window.open(`/produto/${product.id}`, '_blank')}
                        onEdit={() => handleEdit(product)}
                        onDelete={() => handleDelete(product.id)}
                        onToggleActive={() => handleToggleActive(product)}
                        onToggleVisibility={(field, value) => handleToggleVisibility(product, field, value)}
                        getCategoryName={getCategoryName}
                        formatCurrency={formatCurrency}
                        highlightBarcode={barcodeSearch}
                        canManageProducts={canManageProducts}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Exibindo</span>
                    <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-[70px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span>de {filteredProducts.length} itens</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    {getVisiblePages().map((page, index) => (
                      page === 'ellipsis' ? (
                        <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      )
                    ))}
                    
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      <ProductFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={loadData}
        product={editingProduct}
      />

      <ProductImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={loadData}
        categories={categories}
      />
    </AdminLayout>
  );
};

export default Products;
