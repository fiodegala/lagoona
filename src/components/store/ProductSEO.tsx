import { useEffect } from 'react';

interface ProductSEOProps {
  product: {
    id: string;
    name: string;
    description?: string | null;
    image_url?: string | null;
    sku?: string | null;
    barcode?: string | null;
    brand?: string | null;
  };
  price: number;
  promotionalPrice?: number | null;
  currency?: string;
  inStock: boolean;
  stock: number;
  url: string;
  images?: string[];
  rating?: { avg: number; count: number };
  category?: string | null;
  breadcrumbs?: { name: string; url: string }[];
}

const setMeta = (selector: string, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    const [, key, val] = selector.match(/\[([^=]+)="([^"]+)"\]/) || [];
    if (key && val) el.setAttribute(key, val);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
};

const setLink = (rel: string, href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
};

const SCRIPT_ID = 'product-jsonld';
const BREADCRUMB_SCRIPT_ID = 'breadcrumb-jsonld';

const ProductSEO = ({
  product,
  price,
  promotionalPrice,
  currency = 'BRL',
  inStock,
  stock,
  url,
  images = [],
  rating,
  category,
  breadcrumbs,
}: ProductSEOProps) => {
  useEffect(() => {
    const finalPrice = promotionalPrice && promotionalPrice > 0 ? promotionalPrice : price;
    const cleanDesc = (product.description || product.name)
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    const title = `${product.name} | Fio de Gala`;
    const mainImage = product.image_url || images[0] || '';

    document.title = title;
    setMeta('meta[name="description"]', 'content', cleanDesc);
    setLink('canonical', url);

    // Open Graph
    setMeta('meta[property="og:type"]', 'content', 'product');
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', cleanDesc);
    setMeta('meta[property="og:url"]', 'content', url);
    if (mainImage) setMeta('meta[property="og:image"]', 'content', mainImage);
    setMeta('meta[property="og:site_name"]', 'content', 'Fio de Gala');
    setMeta('meta[property="product:price:amount"]', 'content', finalPrice.toFixed(2));
    setMeta('meta[property="product:price:currency"]', 'content', currency);
    setMeta('meta[property="product:availability"]', 'content', inStock ? 'in stock' : 'out of stock');

    // Twitter
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', cleanDesc);
    if (mainImage) setMeta('meta[name="twitter:image"]', 'content', mainImage);

    // JSON-LD Product
    const jsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      description: cleanDesc,
      image: images.length > 0 ? images : (mainImage ? [mainImage] : undefined),
      sku: product.sku || product.id,
      ...(product.barcode ? { gtin: product.barcode } : {}),
      brand: { '@type': 'Brand', name: product.brand || 'Fio de Gala' },
      ...(category ? { category } : {}),
      offers: {
        '@type': 'Offer',
        url,
        priceCurrency: currency,
        price: finalPrice.toFixed(2),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        ...(stock > 0 ? { inventoryLevel: { '@type': 'QuantitativeValue', value: stock } } : {}),
      },
      ...(rating && rating.count > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: rating.avg.toFixed(1),
              reviewCount: rating.count,
            },
          }
        : {}),
    };

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = SCRIPT_ID;
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(jsonLd);

    // BreadcrumbList JSON-LD
    if (breadcrumbs && breadcrumbs.length > 0) {
      const breadcrumbLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: b.url,
        })),
      };
      let bScript = document.getElementById(BREADCRUMB_SCRIPT_ID) as HTMLScriptElement | null;
      if (!bScript) {
        bScript = document.createElement('script');
        bScript.type = 'application/ld+json';
        bScript.id = BREADCRUMB_SCRIPT_ID;
        document.head.appendChild(bScript);
      }
      bScript.text = JSON.stringify(breadcrumbLd);
    }

    return () => {
      document.getElementById(SCRIPT_ID)?.remove();
      document.getElementById(BREADCRUMB_SCRIPT_ID)?.remove();
    };
  }, [product, price, promotionalPrice, currency, inStock, stock, url, images, rating, category, breadcrumbs]);

  return null;
};

export default ProductSEO;
