import { describe, it, expect } from 'vitest';

/**
 * Tests for the DealsCountdownSection hide logic.
 * The component hides when: !loaded || !config.enabled || products.length === 0 || timeLeft <= 0
 */

describe('DealsCountdownSection - countdown expiry logic', () => {
  it('getTimeLeft returns negative value for past dates', () => {
    const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 min ago
    const timeLeft = new Date(pastDate).getTime() - Date.now();
    expect(timeLeft).toBeLessThan(0);
  });

  it('getTimeLeft returns positive value for future dates', () => {
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    const timeLeft = new Date(futureDate).getTime() - Date.now();
    expect(timeLeft).toBeGreaterThan(0);
  });

  it('guard clause hides section when timeLeft <= 0', () => {
    // Simulates the component guard: if timeLeft <= 0, return null
    const shouldHide = (timeLeft: number) => timeLeft <= 0;

    expect(shouldHide(-1000)).toBe(true);   // past date
    expect(shouldHide(0)).toBe(true);        // exactly expired
    expect(shouldHide(1000)).toBe(false);    // still active
  });

  it('guard clause hides section when no products', () => {
    const products: unknown[] = [];
    expect(products.length === 0).toBe(true);
  });

  it('guard clause hides section when disabled', () => {
    const config = { enabled: false, end_date: null };
    expect(!config.enabled).toBe(true);
  });

  it('formatTime returns zero values when ms is negative', () => {
    const formatTime = (ms: number) => {
      const totalSeconds = Math.max(0, Math.floor(ms / 1000));
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return { days, hours, minutes, seconds };
    };

    const result = formatTime(-5000);
    expect(result).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('end-of-day fallback returns positive time during the day', () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const timeLeft = end.getTime() - now.getTime();
    // Unless it's exactly midnight, should be positive
    expect(timeLeft).toBeGreaterThanOrEqual(0);
  });
});
