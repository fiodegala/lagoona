import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

export interface LookbookLook {
  id: string;
  title: string;
  description?: string;
  image_url: string;
  link_url?: string;
  product_ids?: string[];
  tag?: string;
}

export interface LookbookConfig {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  looks?: LookbookLook[];
}

export interface LookbookMiniProduct {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
}

interface LookbookSectionProps {
  /** When provided, skips DB fetch and renders this config (used for live preview). */
  config?: LookbookConfig | null;
  /** Optional product map for preview; otherwise fetched from DB based on config. */
  productsMap?: Record<string, LookbookMiniProduct>;
  /** When true, renders even if `enabled` is false (for preview). */
  forceRender?: boolean;
  /** Disable navigation links (preview). */
  disableLinks?: boolean;
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const LookbookSection = ({ config: configProp, productsMap: productsMapProp, forceRender, disableLinks }: LookbookSectionProps = {}) => {
  const [fetchedConfig, setFetchedConfig] = useState<LookbookConfig | null>(null);
  const [fetchedMap, setFetchedMap] = useState<Record<string, LookbookMiniProduct>>({});

  const config = configProp !== undefined ? configProp : fetchedConfig;
  const productsMap = productsMapProp ?? fetchedMap;
  const usingProps = configProp !== undefined;

  useEffect(() => {
    if (usingProps) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('store_config')
        .select('value')
        .eq('key', 'lookbook')
        .maybeSingle();
      if (!active) return;
      const cfg = (data?.value as LookbookConfig | null) || null;
      setFetchedConfig(cfg);

      const ids = Array.from(
        new Set((cfg?.looks || []).flatMap((l) => l.product_ids || []).filter(Boolean))
      );
      if (ids.length > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, price, promotional_price')
          .in('id', ids);
        if (!active) return;
        const map: Record<string, LookbookMiniProduct> = {};
        (prods || []).forEach((p) => {
          map[p.id] = p as LookbookMiniProduct;
        });
        setFetchedMap(map);
      }
    })();
    return () => {
      active = false;
    };
  }, [usingProps]);

  const looks = (config?.looks || []).filter((l) => l.image_url).slice(0, 3);
  if (!config) return null;
  if (!forceRender && !config.enabled) return null;
  if (looks.length === 0) return null;

  const eyebrow = config.eyebrow || 'Editorial';
  const title = config.title || 'Como combinar';
  const subtitle =
    config.subtitle || 'Looks completos, montados pelo nosso time de estilo.';

  const layoutCols =
    looks.length === 1
      ? 'lg:grid-cols-1'
      : looks.length === 2
      ? 'lg:grid-cols-2'
      : 'lg:grid-cols-3';

  return (
    <section
      className="py-16 md:py-24 bg-store-dark text-white"
      aria-label="Lookbook — Como combinar"
    >
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10 md:mb-14">
          <div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-store-gold font-medium">
              {eyebrow}
            </span>
            <h2 className="mt-2 text-3xl md:text-5xl font-display italic font-bold leading-tight">
              {title}
            </h2>
            <div className="w-12 h-0.5 bg-store-gold mt-3" />
          </div>
          <p className="text-sm md:text-base text-white/60 max-w-md font-light leading-relaxed">
            {subtitle}
          </p>
        </div>

        <div className={`grid grid-cols-1 ${layoutCols} gap-6 md:gap-8`}>
          {looks.map((look, idx) => {
            const products = (look.product_ids || [])
              .map((pid) => productsMap[pid])
              .filter(Boolean) as LookbookMiniProduct[];
            const primaryHref =
              look.link_url || (products[0] ? `/produto/${products[0].id}` : '/loja');

            const ImageWrap = disableLinks
              ? ({ children, className }: { children: React.ReactNode; className?: string }) => (
                  <div className={className} aria-label={`Ver look: ${look.title}`}>{children}</div>
                )
              : ({ children, className }: { children: React.ReactNode; className?: string }) => (
                  <Link to={primaryHref} className={className} aria-label={`Ver look: ${look.title}`}>
                    {children}
                  </Link>
                );

            const ProductRow = ({ id, children }: { id: string; children: React.ReactNode }) =>
              disableLinks ? (
                <span className="flex items-center justify-between gap-3 py-1.5 text-sm">{children}</span>
              ) : (
                <Link
                  to={`/produto/${id}`}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm hover:text-store-gold transition-colors group/item"
                >
                  {children}
                </Link>
              );

            return (
              <article
                key={look.id}
                className="group relative flex flex-col overflow-hidden rounded-sm bg-store-secondary/30 border border-store-gold/10"
              >
                <ImageWrap className="relative block overflow-hidden aspect-[3/4]">
                  <img
                    src={getOptimizedImageUrl(look.image_url, { width: 900, quality: 80 })}
                    alt={look.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-store-dark via-store-dark/30 to-transparent" />

                  {look.tag && (
                    <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[10px] tracking-[0.2em] uppercase font-medium">
                      {look.tag}
                    </span>
                  )}

                  <span className="absolute top-4 right-4 text-[10px] tracking-[0.3em] uppercase text-white/70 font-light">
                    Look {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                    <h3 className="text-xl md:text-2xl font-display italic font-semibold leading-tight">
                      {look.title}
                    </h3>
                    {look.description && (
                      <p className="mt-1.5 text-sm text-white/70 line-clamp-2 font-light">
                        {look.description}
                      </p>
                    )}
                  </div>
                </ImageWrap>

                {products.length > 0 && (
                  <div className="p-5 md:p-6 border-t border-store-gold/10 space-y-2">
                    <div className="text-[10px] tracking-[0.3em] uppercase text-store-gold/80 font-medium mb-2">
                      Peças do look
                    </div>
                    <ul className="space-y-1.5">
                      {products.slice(0, 4).map((p) => {
                        const price =
                          p.promotional_price && p.promotional_price < p.price
                            ? p.promotional_price
                            : p.price;
                        return (
                          <li key={p.id}>
                            <ProductRow id={p.id}>
                              <span className="truncate font-light">{p.name}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="text-white/80 font-medium">
                                  {formatPrice(price)}
                                </span>
                                {!disableLinks && (
                                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover/item:opacity-100 group-hover/item:translate-x-0 transition-all" />
                                )}
                              </span>
                            </ProductRow>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default LookbookSection;
