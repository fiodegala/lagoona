import { useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCSV(content: string, headerMap: Record<string, number>) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  
  // Build actual header map
  const actualMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const clean = h.trim().toLowerCase();
    for (const [key, _] of Object.entries(headerMap)) {
      if (clean === key.toLowerCase()) {
        actualMap[key] = i;
      }
    }
  });
  
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (const [key, idx] of Object.entries(actualMap)) {
      row[key] = values[idx]?.trim() || '';
    }
    rows.push(row);
  }
  return rows;
}

const LegacyImport = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      // Fetch CSVs
      const [productsRes, variationsRes] = await Promise.all([
        fetch('/data/legacy-products.csv'),
        fetch('/data/legacy-variations.csv'),
      ]);

      const productsCsv = await productsRes.text();
      const variationsCsv = await variationsRes.text();

      // Parse products CSV
      const productLines = productsCsv.split('\n').filter(l => l.trim());
      const productHeaders = parseCSVLine(productLines[0]);
      
      const phMap: Record<string, number> = {};
      productHeaders.forEach((h, i) => { phMap[h.trim()] = i; });

      const products = [];
      for (let i = 1; i < productLines.length; i++) {
        const vals = parseCSVLine(productLines[i]);
        const get = (key: string) => vals[phMap[key]]?.trim() || '';
        
        const cat = get('category');
        products.push({
          id: get('id'),
          name: get('name'),
          category: cat === 'null' || cat === '' ? null : cat,
          barcode: get('barcode') || null,
          price: parseFloat(get('price')) || 0,
          stock: parseInt(get('stock')) || 0,
          min_stock: parseInt(get('min_stock')) || 0,
          active: get('active') !== 'false',
          image_url: get('image_url') || null,
          price_varejo: parseFloat(get('price_varejo')) || null,
          price_atacado: parseFloat(get('price_atacado')) || null,
          price_atacarejo: parseFloat(get('price_atacarejo')) || null,
          weight: parseFloat(get('weight')) || null,
          height: parseFloat(get('height')) || null,
          width: parseFloat(get('width')) || null,
          slug: get('slug') || null,
        });
      }

      // Parse variations CSV
      const varLines = variationsCsv.split('\n').filter(l => l.trim());
      const varHeaders = parseCSVLine(varLines[0]);
      
      const vhMap: Record<string, number> = {};
      varHeaders.forEach((h, i) => { vhMap[h.trim()] = i; });

      const variations = [];
      for (let i = 1; i < varLines.length; i++) {
        const vals = parseCSVLine(varLines[i]);
        const get = (key: string) => vals[vhMap[key]]?.trim() || '';
        
        const imgUrl = get('image_url');
        variations.push({
          id: get('id'),
          product_id: get('product_id'),
          attributes: get('attributes'),
          sku: get('sku') || null,
          barcode: get('barcode') || null,
          price: parseFloat(get('price')) || null,
          stock: parseInt(get('stock')) || 0,
          image_url: imgUrl && imgUrl !== 'null' && imgUrl !== '' ? imgUrl : null,
          price_varejo: parseFloat(get('price_varejo')) || null,
          price_atacado: parseFloat(get('price_atacado')) || null,
          price_atacarejo: parseFloat(get('price_atacarejo')) || null,
        });
      }

      console.log(`Parsed ${products.length} products and ${variations.length} variations`);

      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke('import-legacy-products', {
        body: { products, variations },
      });

      if (fnError) throw fnError;
      setResult(data);
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'Erro desconhecido');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Produtos do Sistema Antigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Esta ação importará 100 produtos e ~1200 variações do seu sistema antigo para o banco de dados atual.
              As categorias serão mapeadas automaticamente.
            </p>

            <Button
              onClick={handleImport}
              disabled={isImporting}
              className="w-full gap-2"
              size="lg"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando... (pode demorar alguns minutos)
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Iniciar Importação
                </>
              )}
            </Button>

            {result && (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <strong>Importação concluída!</strong>
                  <br />
                  Produtos inseridos: {result.productsInserted}
                  <br />
                  Produtos com erro: {result.productsSkipped}
                  <br />
                  Variações inseridas: {result.variationsInserted}
                  <br />
                  Variações com erro: {result.variationsSkipped}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default LegacyImport;
