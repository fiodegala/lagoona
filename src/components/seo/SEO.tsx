import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  ogType?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const BASE_URL = "https://fiodegala.shop";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function SEO({ title, description, canonicalPath, ogType = "website", jsonLd }: SEOProps) {
  useEffect(() => {
    const finalTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;
    document.title = finalTitle;

    if (description) {
      const desc = description.length > 160 ? description.slice(0, 157) + "..." : description;
      setMeta("name", "description", desc);
      setMeta("property", "og:description", desc);
    }

    setMeta("property", "og:title", finalTitle);
    setMeta("property", "og:type", ogType);

    const path = canonicalPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const url = `${BASE_URL}${path}`;
    setMeta("property", "og:url", url);
    setCanonical(url);

    // Manage JSON-LD scripts injected by this component
    const existing = document.head.querySelectorAll('script[data-seo-jsonld="true"]');
    existing.forEach((n) => n.parentNode?.removeChild(n));
    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      items.forEach((item) => {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.setAttribute("data-seo-jsonld", "true");
        s.text = JSON.stringify(item);
        document.head.appendChild(s);
      });
    }
    return () => {
      document.head
        .querySelectorAll('script[data-seo-jsonld="true"]')
        .forEach((n) => n.parentNode?.removeChild(n));
    };
  }, [title, description, canonicalPath, ogType, JSON.stringify(jsonLd ?? null)]);

  return null;
}

export default SEO;
