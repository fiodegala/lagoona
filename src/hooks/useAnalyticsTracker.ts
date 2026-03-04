import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'analytics_session_id';

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
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
  if (tag === 'button' || tag === 'a') return 'cta';
  return 'content';
}

// Batch analytics events to reduce DB calls
let eventQueue: Record<string, unknown>[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function queueEvent(event: Record<string, unknown>) {
  eventQueue.push(event);
  if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, 3000); // Flush every 3s
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

export function useAnalyticsTracker() {
  const location = useLocation();
  const pageEntryTime = useRef<number>(Date.now());
  const currentPath = useRef<string>(location.pathname);

  const trackEvent = useCallback((
    eventType: string,
    data: Record<string, unknown> = {}
  ) => {
    queueEvent({
      session_id: getSessionId(),
      event_type: eventType,
      page_path: location.pathname,
      page_title: document.title,
      user_agent: navigator.userAgent,
      screen_width: window.innerWidth,
      ...data,
    });
  }, [location.pathname]);

  // Track page views and time on page
  useEffect(() => {
    const prevPath = currentPath.current;
    const prevEntry = pageEntryTime.current;

    // Send duration for previous page
    if (prevPath !== location.pathname && prevPath) {
      const duration = Date.now() - prevEntry;
      trackEvent('page_view_end', {
        page_path: prevPath,
        duration_ms: duration,
      });
    }

    // Track new page view (deferred)
    currentPath.current = location.pathname;
    pageEntryTime.current = Date.now();
    
    const idleCallback = typeof requestIdleCallback !== 'undefined' 
      ? requestIdleCallback 
      : (cb: () => void) => setTimeout(cb, 100);
    
    idleCallback(() => trackEvent('page_view'));

    // Track duration on unmount/leave
    return () => {
      const duration = Date.now() - pageEntryTime.current;
      if (duration > 500) {
        flushEvents(); // Flush pending events
        const payload = JSON.stringify({
          session_id: getSessionId(),
          event_type: 'page_view_end',
          page_path: currentPath.current,
          page_title: document.title,
          duration_ms: duration,
          user_agent: navigator.userAgent,
          screen_width: window.innerWidth,
        });
        
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/site_analytics_events`;
        navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }));
      }
    };
  }, [location.pathname, trackEvent]);

  // Track clicks on interactive elements (debounced)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('a, button, [role="button"], [data-analytics-click]');
      if (!clickable) return;

      const el = clickable as HTMLElement;
      trackEvent('click', {
        element_id: el.id || el.getAttribute('data-analytics-id') || undefined,
        element_text: (el.textContent || '').slice(0, 100).trim(),
        element_area: getElementArea(el),
      });
    };

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [trackEvent]);

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
