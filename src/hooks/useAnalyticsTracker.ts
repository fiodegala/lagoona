import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'analytics_session_id';
const VISITOR_KEY = 'analytics_visitor_id';
const VISIT_COUNT_KEY = 'analytics_visit_count';
const LAST_VISIT_KEY = 'analytics_last_visit';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

function getVisitCount(): number {
  const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10);
  return count;
}

function incrementVisitCount(): number {
  const count = getVisitCount() + 1;
  localStorage.setItem(VISIT_COUNT_KEY, String(count));
  localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  return count;
}

function isNewVisitor(): boolean {
  return getVisitCount() <= 1;
}

function getLastVisit(): string | null {
  return localStorage.getItem(LAST_VISIT_KEY);
}

function getReferrer(): string {
  try {
    const ref = document.referrer;
    if (!ref) return 'direct';
    const url = new URL(ref);
    if (url.hostname === window.location.hostname) return 'internal';
    return url.hostname;
  } catch {
    return 'unknown';
  }
}

function getTrafficSource(): { source: string; medium: string; campaign: string } {
  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source');
  const utmMedium = params.get('utm_medium');
  const utmCampaign = params.get('utm_campaign');

  if (utmSource) {
    return {
      source: utmSource,
      medium: utmMedium || 'unknown',
      campaign: utmCampaign || '',
    };
  }

  const ref = document.referrer;
  if (!ref) return { source: 'direct', medium: 'none', campaign: '' };

  try {
    const url = new URL(ref);
    const host = url.hostname.toLowerCase();
    if (host === window.location.hostname) return { source: 'internal', medium: 'none', campaign: '' };
    if (host.includes('google')) return { source: 'google', medium: 'organic', campaign: '' };
    if (host.includes('bing')) return { source: 'bing', medium: 'organic', campaign: '' };
    if (host.includes('instagram')) return { source: 'instagram', medium: 'social', campaign: '' };
    if (host.includes('facebook') || host.includes('fb.com')) return { source: 'facebook', medium: 'social', campaign: '' };
    if (host.includes('tiktok')) return { source: 'tiktok', medium: 'social', campaign: '' };
    if (host.includes('youtube')) return { source: 'youtube', medium: 'social', campaign: '' };
    if (host.includes('whatsapp') || host.includes('wa.me')) return { source: 'whatsapp', medium: 'messaging', campaign: '' };
    if (host.includes('twitter') || host.includes('x.com')) return { source: 'twitter', medium: 'social', campaign: '' };
    if (host.includes('pinterest')) return { source: 'pinterest', medium: 'social', campaign: '' };
    return { source: host, medium: 'referral', campaign: '' };
  } catch {
    return { source: 'unknown', medium: 'unknown', campaign: '' };
  }
}

function getUtmParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const search = new URLSearchParams(window.location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(key => {
    const val = search.get(key);
    if (val) params[key] = val;
  });
  return params;
}

function getDeviceInfo(): { device_type: string; browser: string; os: string } {
  const ua = navigator.userAgent;
  const width = window.innerWidth;

  let device_type = 'desktop';
  if (width <= 768 || /Mobi|Android|iPhone|iPad/i.test(ua)) device_type = 'mobile';
  else if (width <= 1024 || /Tablet|iPad/i.test(ua)) device_type = 'tablet';

  let browser = 'other';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'safari';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Edg')) browser = 'edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'opera';

  let os = 'other';
  if (ua.includes('Windows')) os = 'windows';
  else if (ua.includes('Mac')) os = 'macos';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'linux';
  else if (ua.includes('Android')) os = 'android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'ios';

  return { device_type, browser, os };
}

function getLocationInfo(): { timezone: string; language: string } {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    language: navigator.language || 'unknown',
  };
}

function getElementArea(el: HTMLElement): string {
  const closest = el.closest('[data-analytics-area]');
  if (closest) return closest.getAttribute('data-analytics-area') || 'unknown';

  if (el.closest('header') || el.closest('nav')) return 'header';
  if (el.closest('footer')) return 'footer';
  if (el.closest('[class*="hero"]') || el.closest('[class*="banner"]')) return 'hero';
  if (el.closest('[class*="product"]')) return 'products';
  if (el.closest('[class*="cart"]')) return 'cart';
  if (el.closest('[class*="checkout"]')) return 'checkout';
  const tag = el.tagName.toLowerCase();
  if (tag === 'button' || tag === 'a') return 'cta';
  return 'content';
}

// Batch analytics events to reduce DB calls
let eventQueue: Record<string, unknown>[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function queueEvent(event: Record<string, unknown>) {
  eventQueue.push(event);
  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, 3000);
  }
}

async function flushEvents() {
  flushTimer = null;
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0);
  try {
    await supabase.from('site_analytics_events' as any).insert(batch as any);
  } catch {
    // Silently fail
  }
}

function sendBeaconEvent(event: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/site_analytics_events`;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Silently fail
  }
}

function buildBaseEvent(eventType: string, extra: Record<string, unknown> = {}) {
  const device = getDeviceInfo();
  const location = getLocationInfo();
  const traffic = getTrafficSource();

  return {
    session_id: getSessionId(),
    event_type: eventType,
    page_path: window.location.pathname,
    page_title: document.title,
    user_agent: navigator.userAgent,
    screen_width: window.innerWidth,
    metadata: {
      visitor_id: getVisitorId(),
      referrer: getReferrer(),
      ...device,
      ...location,
      traffic_source: traffic.source,
      traffic_medium: traffic.medium,
      traffic_campaign: traffic.campaign,
      is_new_visitor: isNewVisitor(),
      visit_count: getVisitCount(),
      ...getUtmParams(),
      ...(extra.metadata as Record<string, unknown> || {}),
    },
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'metadata')),
  };
}

// Global function to track events from outside React
export function trackAnalyticsEvent(
  eventType: string,
  data: Record<string, unknown> = {}
) {
  queueEvent(buildBaseEvent(eventType, data));
}

// Track search queries
export function trackSearchEvent(query: string, resultsCount: number) {
  trackAnalyticsEvent('search', {
    metadata: {
      search_query: query,
      results_count: resultsCount,
    },
  });
}

// Track favorite events
export function trackFavoriteEvent(action: 'add' | 'remove', productId: string) {
  trackAnalyticsEvent(`favorite_${action}`, {
    product_id: productId,
  });
}

// Track cart remove event
export function trackCartRemoveEvent(productId: string, productName: string) {
  trackAnalyticsEvent('remove_from_cart', {
    product_id: productId,
    metadata: { product_name: productName },
  });
}

export function useAnalyticsTracker() {
  const location = useLocation();
  const pageEntryTime = useRef<number>(Date.now());
  const currentPath = useRef<string>(location.pathname);
  const maxScrollDepth = useRef<number>(0);
  const sessionPagesViewed = useRef<Set<string>>(new Set());
  const hasIncremented = useRef(false);

  const trackEvent = useCallback((
    eventType: string,
    data: Record<string, unknown> = {}
  ) => {
    trackAnalyticsEvent(eventType, data);
  }, []);

  // Increment visit count once per session
  useEffect(() => {
    if (!hasIncremented.current) {
      hasIncremented.current = true;
      incrementVisitCount();
      
      // Track session_start with device/location/traffic
      const device = getDeviceInfo();
      const location = getLocationInfo();
      const traffic = getTrafficSource();
      trackEvent('session_start', {
        metadata: {
          ...device,
          ...location,
          traffic_source: traffic.source,
          traffic_medium: traffic.medium,
          traffic_campaign: traffic.campaign,
          is_new_visitor: isNewVisitor(),
          visit_count: getVisitCount(),
          last_visit: getLastVisit(),
        },
      });
    }
  }, [trackEvent]);

  // Track page views and time on page
  useEffect(() => {
    const prevPath = currentPath.current;
    const prevEntry = pageEntryTime.current;
    const prevScroll = maxScrollDepth.current;

    if (prevPath !== location.pathname && prevPath) {
      const duration = Date.now() - prevEntry;
      trackEvent('page_view_end', {
        page_path: prevPath,
        duration_ms: duration,
        metadata: {
          visitor_id: getVisitorId(),
          scroll_depth: prevScroll,
          referrer: getReferrer(),
        },
      });
    }

    currentPath.current = location.pathname;
    pageEntryTime.current = Date.now();
    maxScrollDepth.current = 0;
    sessionPagesViewed.current.add(location.pathname);

    const idleCallback = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 100);

    idleCallback(() => trackEvent('page_view', {
      metadata: {
        visitor_id: getVisitorId(),
        referrer: getReferrer(),
        pages_in_session: sessionPagesViewed.current.size,
        ...getUtmParams(),
      },
    }));

    return () => {
      const duration = Date.now() - pageEntryTime.current;
      if (duration > 500) {
        flushEvents();
        sendBeaconEvent(buildBaseEvent('page_view_end', {
          page_path: currentPath.current,
          duration_ms: duration,
          metadata: {
            scroll_depth: maxScrollDepth.current,
          },
        }));
      }
    };
  }, [location.pathname, trackEvent]);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const depth = Math.round((window.scrollY / scrollHeight) * 100);
      if (depth > maxScrollDepth.current) {
        maxScrollDepth.current = depth;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track clicks with coordinates for heatmap
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('a, button, [role="button"], [data-analytics-click]');
      if (!clickable) return;

      const el = clickable as HTMLElement;
      const href = el.getAttribute('href');

      trackEvent('click', {
        element_id: el.id || el.getAttribute('data-analytics-id') || undefined,
        element_text: (el.textContent || '').slice(0, 100).trim(),
        element_area: getElementArea(el),
        metadata: {
          visitor_id: getVisitorId(),
          href: href || undefined,
          tag: el.tagName.toLowerCase(),
          click_x: Math.round((e.clientX / window.innerWidth) * 100),
          click_y: Math.round((e.clientY / window.innerHeight) * 100),
          page_x: e.pageX,
          page_y: e.pageY,
        },
      });
    };

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [trackEvent]);

  // Flush on page visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushEvents();
      }
    };

    const handleBeforeUnload = () => {
      flushEvents();
      const duration = Date.now() - pageEntryTime.current;
      
      // Track bounce: only 1 page viewed and short duration
      const pagesViewed = sessionPagesViewed.current.size;
      if (pagesViewed <= 1 && duration < 30000) {
        sendBeaconEvent(buildBaseEvent('bounce', {
          duration_ms: duration,
          metadata: { pages_viewed: pagesViewed },
        }));
      }

      if (duration > 500) {
        sendBeaconEvent(buildBaseEvent('page_view_end', {
          page_path: currentPath.current,
          duration_ms: duration,
          metadata: {
            scroll_depth: maxScrollDepth.current,
          },
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return { trackEvent };
}

export function useProductViewTracker(productId: string | undefined) {
  const { trackEvent } = useAnalyticsTracker();
  const tracked = useRef(false);

  useEffect(() => {
    if (productId && !tracked.current) {
      tracked.current = true;
      trackEvent('product_view', { product_id: productId });
    }
  }, [productId, trackEvent]);
}
