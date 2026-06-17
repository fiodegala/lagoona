import { describe, it, expect } from 'vitest';
import { computeDateRange, parseLocalDate } from './dateRange';

/**
 * These tests guard against the timezone bug where `new Date("YYYY-MM-DD")`
 * is parsed as UTC midnight, shifting the calendar day in negative-offset
 * timezones such as America/Sao_Paulo (UTC-3).
 *
 * We assert against local Date getters (getFullYear/getMonth/getDate) so the
 * tests are valid in any host timezone — they verify the chosen instant
 * represents the expected LOCAL calendar day.
 */

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD as local midnight (not UTC)', () => {
    const d = parseLocalDate('2026-06-05');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-indexed)
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('does not shift the calendar day in negative-offset timezones', () => {
    // Reproduces the Sales page bug: in UTC-3, `new Date("2026-06-05")`
    // (UTC midnight) becomes 2026-06-04 21:00 local. parseLocalDate must
    // always return the *same* calendar date regardless of host TZ.
    const d = parseLocalDate('2026-06-05');
    expect(d.getDate()).toBe(5);
    expect(d.getMonth()).toBe(5);
  });
});

describe('computeDateRange - custom period', () => {
  it('returns start at LOCAL 00:00 and end at LOCAL 23:59 of the chosen days', () => {
    const { start, end } = computeDateRange('custom', '2026-06-05', '2026-06-05');

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(5);
    expect(start.getDate()).toBe(5);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(5);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('includes a sale made at 15:55 UTC on the selected day (Brasília case)', () => {
    // Regression: Myrelle's sale on 2026-06-05 15:55Z must fall inside the
    // 05/06/2026 → 05/06/2026 filter when the host runs in America/Sao_Paulo.
    const { start, end } = computeDateRange('custom', '2026-06-05', '2026-06-05');
    const saleAt = new Date('2026-06-05T15:55:39Z');

    expect(saleAt.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(saleAt.getTime()).toBeLessThanOrEqual(end.getTime());
  });

  it('handles multi-day ranges correctly', () => {
    const { start, end } = computeDateRange('custom', '2026-01-01', '2026-01-31');
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(0);
    expect(end.getDate()).toBe(31);
    expect(end.getMonth()).toBe(0);
    // Whole month spans at least 30 days.
    expect((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)).toBeGreaterThan(29);
  });

  it('falls back to last 30 days when customStart is empty', () => {
    const now = new Date('2026-06-15T12:00:00');
    const { start, end } = computeDateRange('custom', '', '', now);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });
});

describe('computeDateRange - preset periods', () => {
  const fixedNow = new Date('2026-06-15T12:00:00');

  it('today', () => {
    const { start, end } = computeDateRange('today', '', '', fixedNow);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(15);
    expect(end.getHours()).toBe(23);
  });

  it('yesterday', () => {
    const { start, end } = computeDateRange('yesterday', '', '', fixedNow);
    expect(start.getDate()).toBe(14);
    expect(end.getDate()).toBe(14);
  });

  it('month starts on day 1', () => {
    const { start } = computeDateRange('month', '', '', fixedNow);
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(5);
  });
});
