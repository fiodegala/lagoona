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

    ((f, b, e, v, n, t, s) => {
      if ((f as Window).fbq) return;
      n = function (...args: unknown[]) {
        if ((n as { callMethod?: (...innerArgs: unknown[]) => void }).callMethod) {
          (n as { callMethod: (...innerArgs: unknown[]) => void }).callMethod(...args);
        } else {
          ((n as { queue?: unknown[][] }).queue ||= []).push(args);
        }
      };
      if (!(f as Window)._fbq) (f as Window)._fbq = n as (...innerArgs: unknown[]) => void;
      (f as Window).fbq = n as (...innerArgs: unknown[]) => void;
      (n as { push?: unknown; loaded?: boolean; version?: string; queue?: unknown[][] }).push = n;
      (n as { push?: unknown; loaded?: boolean; version?: string; queue?: unknown[][] }).loaded = true;
      (n as { push?: unknown; loaded?: boolean; version?: string; queue?: unknown[][] }).version = '2.0';
      (n as { push?: unknown; loaded?: boolean; version?: string; queue?: unknown[][] }).queue = [];
      t = b.createElement(e) as HTMLScriptElement;
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js', null as unknown as Function, null as unknown as HTMLScriptElement, null as unknown as Element);
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
