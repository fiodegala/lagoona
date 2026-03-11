/**
 * Meta Pixel (fbq) helper utilities.
 * Includes resilient runtime initialization to avoid missing events
 * when inline scripts are blocked/delayed.
 */

const META_PIXEL_ID = '1707142150464689';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    __metaPixelInitialized?: boolean;
  }
}

let scriptRequested = false;

function ensureMetaPixelInitialized() {
  if (typeof window === 'undefined') return;

  if (!window.fbq && !scriptRequested) {
    scriptRequested = true;

    ((f: Window & typeof globalThis, b: Document, e: 'script', v: string) => {
      if (f.fbq) return;

      const n: any = function (...args: unknown[]) {
        if (n.callMethod) {
          n.callMethod.apply(n, args);
        } else {
          n.queue.push(args);
        }
      };

      if (!f._fbq) f._fbq = n;
      f.fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];

      const t = b.createElement(e);
      t.async = true;
      t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }

  if (window.fbq && !window.__metaPixelInitialized) {
    window.fbq('init', META_PIXEL_ID);
    window.__metaPixelInitialized = true;
  }
}

function fbqTrack(method: 'track' | 'trackCustom', eventName: string, params?: Record<string, unknown>) {
  ensureMetaPixelInitialized();
  if (!window.fbq) return;
  if (params) {
    window.fbq(method, eventName, params);
  } else {
    window.fbq(method, eventName);
  }
}

export function initMetaPixel() {
  ensureMetaPixelInitialized();
}

// ─── Standard Events ───────────────────────────────────────

export function trackMetaPageView() {
  fbqTrack('track', 'PageView');
}

export function trackMetaViewContent(params: {
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  value?: number;
  currency?: string;
}) {
  fbqTrack('track', 'ViewContent', {
    content_type: 'product',
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaAddToCart(params: {
  content_ids: string[];
  content_name: string;
  content_type?: string;
  value: number;
  currency?: string;
  quantity?: number;
}) {
  fbqTrack('track', 'AddToCart', {
    content_type: 'product',
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaAddToWishlist(params: {
  content_ids: string[];
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  fbqTrack('track', 'AddToWishlist', {
    content_type: 'product',
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaInitiateCheckout(params: {
  content_ids?: string[];
  num_items?: number;
  value?: number;
  currency?: string;
}) {
  fbqTrack('track', 'InitiateCheckout', {
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaPurchase(params: {
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  value: number;
  currency?: string;
  order_id?: string;
}) {
  fbqTrack('track', 'Purchase', {
    content_type: 'product',
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaSearch(params: {
  search_string: string;
  content_ids?: string[];
}) {
  fbqTrack('track', 'Search', params);
}

export function trackMetaCompleteRegistration(params?: {
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  fbqTrack('track', 'CompleteRegistration', {
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaContact() {
  fbqTrack('track', 'Contact');
}

// ─── Custom Events ─────────────────────────────────────────

export function trackMetaCustomEvent(eventName: string, params?: Record<string, unknown>) {
  fbqTrack('trackCustom', eventName, params);
}
