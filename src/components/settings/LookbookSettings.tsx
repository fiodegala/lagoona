import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Check, Plus, Trash2, Layers, X, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { productsService, Product } from '@/services/products';
import { toast } from 'sonner';
import ImageUpload from '@/components/ImageUpload';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import LookbookSection, { type LookbookConfig, type LookbookLook, type LookbookMiniProduct } from '@/components/store/LookbookSection';
import { useMemo } from 'react';

const newLook = (): LookbookLook => ({
  id: crypto.randomUUID(),
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  product_ids: [],
  tag: '',
});

const LookbookSettings = () => {
  const [config, setConfig] = useState<LookbookConfig>({
    enabled: true,
    title: 'Como combinar',
    subtitle: 'Looks completos, montados pelo nosso time de estilo.',
    eyebrow: 'Editorial',
    looks: [],
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [allProducts, configRes] = await Promise.all([
          productsService.getAll(),
          supabase.from('store_config').select('value').eq('key', 'lookbook').maybeSingle(),
        ]);
        setProducts(allProducts.filter((p) => p.is_active));
        if (configRes.data?.value) {
          const v = configRes.data.value as LookbookConfig;
          setConfig({
            enabled: v.enabled ?? true,
            title: v.title ?? 'Como combinar',
            subtitle: v.subtitle ?? '',
            eyebrow: v.eyebrow ?? 'Editorial',
            looks: Array.isArray(v.looks) ? v.looks : [],
          });
        }
      } catch (err) {
        console.error('Error loading lookbook settings:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const updateLook = (idx: number, patch: Partial<LookbookLook>) => {
    setConfig((c) => {
      const looks = [...(c.looks || [])];
      looks[idx] = { ...looks[idx], ...patch };
      return { ...c, looks };
    });
  };

  const removeLook = (idx: number) => {
    setConfig((c) => ({ ...c, looks: (c.looks || []).filter((_, i) => i !== idx) }));
  };

  const addLook = () => {
    if ((config.looks?.length || 0) >= 3) {
      toast.info('Máximo de 3 looks no lookbook.');
      return;
    }
    setConfig((c) => ({ ...c, looks: [...(c.looks || []), newLook()] }));
  };

  const toggleProduct = (lookIdx: number, productId: string) => {
    const look = config.looks?.[lookIdx];
    if (!look) return;
    const ids = look.product_ids || [];
    const next = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
    updateLook(lookIdx, { product_ids: next });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleaned: LookbookConfig = {
        ...config,
        looks: (config.looks || []).map((l) => ({
          id: l.id || crypto.randomUUID(),
          title: l.title?.trim() || 'Sem título',
          description: l.description?.trim() || '',
          image_url: l.image_url || '',
          link_url: l.link_url?.trim() || '',
          product_ids: (l.product_ids || []).filter(Boolean),
          tag: l.tag?.trim() || '',
        })),
      };

      const { data: existing } = await supabase
        .from('store_config')
        .select('id')
        .eq('key', 'lookbook')
        .maybeSingle();

      const value = cleaned as unknown as Record<string, unknown>;
      const res = existing
        ? await supabase
            .from('store_config')
            .update({ value: value as never, is_public: true, updated_at: new Date().toISOString() })
            .eq('key', 'lookbook')
        : await supabase
            .from('store_config')
            .insert({ key: 'lookbook', value: value as never, is_public: true } as never);

      if (res.error) throw res.error;
      toast.success('Lookbook atualizado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar lookbook');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Build product map for live preview from currently-selected products in the editor.
  const previewMap: Record<string, LookbookMiniProduct> = useMemo(() => {
    const ids = new Set<string>();
    (config.looks || []).forEach((l) => (l.product_ids || []).forEach((id) => ids.add(id)));
    const map: Record<string, LookbookMiniProduct> = {};
    products.forEach((p) => {
      if (ids.has(p.id)) {
        map[p.id] = {
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          promotional_price:
            (p as Product & { promotional_price?: number | null }).promotional_price ?? null,
        };
      }
    });
    return map;
  }, [config.looks, products]);

  const hasRenderableLook = (config.looks || []).some((l) => l.image_url);
  return (
    <Card className="card-elevated">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Lookbook — Como combinar
        </CardTitle>
        <CardDescription>
          Banner editorial com até 3 looks completos clicáveis. Reforça o posicionamento premium da marca.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live preview */}
        <div className="rounded-lg border overflow-hidden bg-store-dark">
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-white/10 bg-store-dark/80">
            <div className="flex items-center gap-2 text-white/70 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Preview ao vivo {!config.enabled && <span className="text-amber-300">(desativado na home)</span>}
            </div>
            <span className="text-[10px] tracking-[0.25em] uppercase text-store-gold/80">
              {(config.looks || []).filter((l) => l.image_url).length}/3 looks
            </span>
          </div>
          {hasRenderableLook ? (
            <div className="overflow-x-auto">
              <div className="origin-top-left scale-[0.6] sm:scale-75 lg:scale-90 transform-gpu w-[166%] sm:w-[133%] lg:w-[111%]">
                <LookbookSection
                  config={config}
                  productsMap={previewMap}
                  forceRender
                  disableLinks
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-white/40 text-sm gap-2">
              <Layers className="h-8 w-8" />
              Adicione um look com imagem para ver o preview.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Exibir lookbook na home</p>
            <p className="text-xs text-muted-foreground">Aparece logo após "Mais vendidos".</p>
          </div>
          <Switch
            checked={!!config.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Eyebrow</Label>
            <Input
              value={config.eyebrow || ''}
              onChange={(e) => setConfig((c) => ({ ...c, eyebrow: e.target.value }))}
              placeholder="Editorial"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Título</Label>
            <Input
              value={config.title || ''}
              onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
              placeholder="Como combinar"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Subtítulo</Label>
          <Textarea
            rows={2}
            value={config.subtitle || ''}
            onChange={(e) => setConfig((c) => ({ ...c, subtitle: e.target.value }))}
            placeholder="Looks completos, montados pelo nosso time de estilo."
          />
        </div>

        <div className="space-y-4">
          {(config.looks || []).map((look, idx) => {
            const selected = (look.product_ids || [])
              .map((id) => products.find((p) => p.id === id))
              .filter(Boolean) as Product[];
            return (
              <div key={look.id} className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Look {idx + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeLook(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                  <div>
                    <Label className="text-xs">Imagem editorial</Label>
                    <div className="mt-1">
                      <ImageUpload
                        value={look.image_url}
                        onChange={(url) => updateLook(idx, { image_url: url || '' })}
                        bucket="product-images"
                        folder="lookbook"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Título do look</Label>
                        <Input
                          value={look.title}
                          onChange={(e) => updateLook(idx, { title: e.target.value })}
                          placeholder="Domingo no Leblon"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tag (opcional)</Label>
                        <Input
                          value={look.tag || ''}
                          onChange={(e) => updateLook(idx, { tag: e.target.value })}
                          placeholder="Verão 26"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição curta</Label>
                      <Textarea
                        rows={2}
                        value={look.description || ''}
                        onChange={(e) => updateLook(idx, { description: e.target.value })}
                        placeholder="Camisa de linho com calça alfaiataria leve."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Link da imagem (opcional — padrão: 1ª peça)</Label>
                      <Input
                        value={look.link_url || ''}
                        onChange={(e) => updateLook(idx, { link_url: e.target.value })}
                        placeholder="/loja/categoria/camisas"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Peças do look</Label>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {selected.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border text-xs"
                          >
                            {p.name}
                            <button
                              type="button"
                              onClick={() => toggleProduct(idx, p.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7">
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Adicionar peça
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[320px]" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar produto..." />
                              <CommandList>
                                <CommandEmpty>Nenhum produto.</CommandEmpty>
                                <CommandGroup>
                                  {products.map((p) => {
                                    const checked = (look.product_ids || []).includes(p.id);
                                    return (
                                      <CommandItem
                                        key={p.id}
                                        value={p.name}
                                        onSelect={() => toggleProduct(idx, p.id)}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            checked ? 'opacity-100' : 'opacity-0'
                                          }`}
                                        />
                                        {p.name}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <Button variant="outline" onClick={addLook} className="w-full" disabled={(config.looks?.length || 0) >= 3}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar look ({config.looks?.length || 0}/3)
          </Button>
        </div>

        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar lookbook
        </Button>
      </CardContent>
    </Card>
  );
};

export default LookbookSettings;
