import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'analytics_session_id';
const VISITOR_KEY = 'analytics_visitor_id';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Persistent visitor ID across sessions (like a pixel cookie)
function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
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

function getUtmParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const search = new URLSearchParams(window.location.search);
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(key => {
    const val = search.get(key);
    if (val) params[key] = val;
  });
  return params;
}

function getElementArea(el: HTMLElement): string {
  const closest = el.closest('[data-analytics-area]');
  if (closest) return closest.getAttribute('data-analytics-area') || 'unknown';
  
  const tag = el.tagName.toLowerCase();
  if (el.closest('header') || el.closest('nav')) return 'header';
  if (el.closest('footer')) return 'footer';
  if (el.closest('[class*="hero"]') || el.closest('[class*="banner"]')) return 'hero';
  if (el.closest('[class*="product"]')) return 'products';
  if (el.closest('[class*="cart"]')) return 'cart';
  if (el.closest('[class*="checkout"]')) return 'checkout';
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

// Send beacon with proper auth headers via fetch keepalive
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

// Global function to track events from outside React (CartContext, etc.)
export function trackAnalyticsEvent(
  eventType: string,
  data: Record<string, unknown> = {}
) {
  queueEvent({
    session_id: getSessionId(),
    event_type: eventType,
    page_path: window.location.pathname,
    page_title: document.title,
    user_agent: navigator.userAgent,
    screen_width: window.innerWidth,
    metadata: {
      visitor_id: getVisitorId(),
      referrer: getReferrer(),
      ...getUtmParams(),
    },
    ...data,
  });
}

export function useAnalyticsTracker() {
  const location = useLocation();
  const pageEntryTime = useRef<number>(Date.now());
  const currentPath = useRef<string>(location.pathname);
  const maxScrollDepth = useRef<number>(0);

  const trackEvent = useCallback((
    eventType: string,
    data: Record<string, unknown> = {}
  ) => {
    trackAnalyticsEvent(eventType, data);
  }, []);

  // Track page views and time on page
  useEffect(() => {
    const prevPath = currentPath.current;
    const prevEntry = pageEntryTime.current;
    const prevScroll = maxScrollDepth.current;

    // Send duration + scroll depth for previous page
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

    // Reset for new page
    currentPath.current = location.pathname;
    pageEntryTime.current = Date.now();
    maxScrollDepth.current = 0;
    
    const idleCallback = typeof requestIdleCallback !== 'undefined' 
      ? requestIdleCallback 
      : (cb: () => void) => setTimeout(cb, 100);
    
    idleCallback(() => trackEvent('page_view', {
      metadata: {
        visitor_id: getVisitorId(),
        referrer: getReferrer(),
        ...getUtmParams(),
      },
    }));

    // Track duration on unmount/leave
    return () => {
      const duration = Date.now() - pageEntryTime.current;
      if (duration > 500) {
        flushEvents();
        sendBeaconEvent({
          session_id: getSessionId(),
          event_type: 'page_view_end',
          page_path: currentPath.current,
          page_title: document.title,
          duration_ms: duration,
          user_agent: navigator.userAgent,
          screen_width: window.innerWidth,
          metadata: {
            visitor_id: getVisitorId(),
            scroll_depth: maxScrollDepth.current,
          },
        });
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

  // Track clicks on interactive elements
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
        },
      });
    };

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [trackEvent]);

  // Flush on page visibility change (tab close, minimize)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushEvents();
      }
    };
    
    const handleBeforeUnload = () => {
      flushEvents();
      const duration = Date.now() - pageEntryTime.current;
      if (duration > 500) {
        sendBeaconEvent({
          session_id: getSessionId(),
          event_type: 'page_view_end',
          page_path: currentPath.current,
          page_title: document.title,
          duration_ms: duration,
          user_agent: navigator.userAgent,
          screen_width: window.innerWidth,
          metadata: {
            visitor_id: getVisitorId(),
            scroll_depth: maxScrollDepth.current,
          },
        });
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
