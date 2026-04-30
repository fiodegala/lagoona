import { useState, useEffect, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, DollarSign } from "lucide-react";

interface VariationPrice {
  id: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  wholesale_price: number | null;
  exclusive_price: number | null;
  promotional_price: number | null;
  is_active: boolean;
  attribute_label: string;
}

interface ProductWithPrices {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  wholesale_price: number | null;
  exclusive_price: number | null;
  promotional_price: number | null;
  is_active: boolean;
  barcode: string | null;
  category_name: string | null;
  variations: VariationPrice[];
}

const fmt = (v: number | null | undefined) =>
  v != null ? `R$ ${v.toFixed(2).replace(".", ",")}` : "—";

const ProductPricing = () => {
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch products with category
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, image_url, price, wholesale_price, exclusive_price, promotional_price, is_active, barcode, category_id, categories(name)")
        .order("name", { ascending: true });

      if (!prods) { setLoading(false); return; }

      // Fetch all variations with attribute values
      const productIds = prods.map((p: any) => p.id);

      // Batch variations (handle >1000)
      let allVariations: any[] = [];
      for (let i = 0; i < productIds.length; i += 500) {
        const batch = productIds.slice(i, i + 500);
        const { data: vars } = await supabase
          .from("product_variations")
          .select("id, product_id, sku, barcode, price, wholesale_price, exclusive_price, promotional_price, is_active")
          .in("product_id", batch)
          .order("sort_order", { ascending: true });
        if (vars) allVariations.push(...vars);
      }

      // Fetch variation attribute values
      const varIds = allVariations.map((v: any) => v.id);
      let allLinks: any[] = [];
      for (let i = 0; i < varIds.length; i += 500) {
        const batch = varIds.slice(i, i + 500);
        const { data: links } = await supabase
          .from("product_variation_values")
          .select("variation_id, product_attribute_values(value, product_attributes(name))")
          .in("variation_id", batch);
        if (links) allLinks.push(...links);
      }

      // Build label map per variation
      const labelMap: Record<string, string> = {};
      for (const link of allLinks) {
        const vid = link.variation_id;
        const val = link.product_attribute_values?.value || "";
        labelMap[vid] = labelMap[vid] ? `${labelMap[vid]} / ${val}` : val;
      }

      // Group variations by product
      const varsByProduct: Record<string, VariationPrice[]> = {};
      for (const v of allVariations) {
        if (!varsByProduct[v.product_id]) varsByProduct[v.product_id] = [];
        varsByProduct[v.product_id].push({
          id: v.id,
          sku: v.sku,
          barcode: v.barcode,
          price: v.price,
          wholesale_price: v.wholesale_price,
          exclusive_price: v.exclusive_price,
          promotional_price: v.promotional_price,
          is_active: v.is_active,
          attribute_label: labelMap[v.id] || "Sem atributos",
        });
      }

      const result: ProductWithPrices[] = prods.map((p: any) => ({
        id: p.id,
        name: p.name,
        image_url: p.image_url,
        price: p.price,
        wholesale_price: p.wholesale_price,
        exclusive_price: p.exclusive_price,
        promotional_price: p.promotional_price,
        is_active: p.is_active,
        barcode: p.barcode,
        category_name: p.categories?.name || null,
        variations: varsByProduct[p.id] || [],
      }));

      setProducts(result);
    } catch (err) {
      console.error("Erro ao carregar preços:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category_name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.variations.some(
          (v) =>
            v.sku?.toLowerCase().includes(q) ||
            v.barcode?.toLowerCase().includes(q) ||
            v.attribute_label.toLowerCase().includes(q)
        )
    );
  }, [products, search]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Valores de Produtos</h1>
              <p className="text-sm text-muted-foreground">
                Visualize todos os preços de produtos e variações
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-barcode-input
              autoFocus
              placeholder="Buscar por nome, SKU, código de barras ou atributo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Produto / Variação</TableHead>
                  <TableHead className="text-right min-w-[110px]">Varejo</TableHead>
                  <TableHead className="text-right min-w-[110px]">Atacado</TableHead>
                  <TableHead className="text-right min-w-[110px]">Exclusivo</TableHead>
                  <TableHead className="text-right min-w-[110px]">Promocional</TableHead>
                  <TableHead className="text-center min-w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((product) => (
                    <>
                      {/* Product row */}
                      <TableRow key={product.id} className="bg-muted/30 font-medium">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                ?
                              </div>
                            )}
                            <div>
                              <span className="font-semibold text-sm">{product.name}</span>
                              {product.category_name && (
                                <span className="block text-xs text-muted-foreground">
                                  {product.category_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(product.price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(product.wholesale_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(product.exclusive_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {fmt(product.promotional_price)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                            {product.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Variation rows */}
                      {product.variations.map((v) => (
                        <TableRow key={v.id} className="text-sm">
                          <TableCell className="pl-14">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">↳</span>
                              <span>{v.attribute_label}</span>
                              {v.sku && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  ({v.sku})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmt(v.price)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmt(v.wholesale_price)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmt(v.exclusive_price)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {fmt(v.promotional_price)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={v.is_active ? "outline" : "secondary"}
                              className="text-xs"
                            >
                              {v.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ProductPricing;
