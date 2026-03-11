/**
 * Meta Pixel (fbq) helper utilities.
 * The pixel script is loaded globally via index.html.
 * These helpers provide type-safe wrappers around the fbq() calls.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbq(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq(...args);
  }
}

// ─── Standard Events ───────────────────────────────────────

export function trackMetaPageView() {
  fbq('track', 'PageView');
}

export function trackMetaViewContent(params: {
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  value?: number;
  currency?: string;
}) {
  fbq('track', 'ViewContent', {
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
  fbq('track', 'AddToCart', {
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
  fbq('track', 'AddToWishlist', {
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
  fbq('track', 'InitiateCheckout', {
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
  fbq('track', 'Purchase', {
    content_type: 'product',
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaSearch(params: {
  search_string: string;
  content_ids?: string[];
}) {
  fbq('track', 'Search', params);
}

export function trackMetaCompleteRegistration(params?: {
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  fbq('track', 'CompleteRegistration', {
    currency: 'BRL',
    ...params,
  });
}

export function trackMetaContact() {
  fbq('track', 'Contact');
}

// ─── Custom Events ─────────────────────────────────────────

export function trackMetaCustomEvent(eventName: string, params?: Record<string, unknown>) {
  fbq('trackCustom', eventName, params);
}
