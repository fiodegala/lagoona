import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isValentinesPromoActive,
  validateInstallmentsForPromo,
} from "./valentinesPromo.ts";

const NOW = new Date("2026-06-12T12:00:00Z");
const ACTIVE_CFG = {
  enabled: true,
  starts_at: "2026-06-01T00:00:00Z",
  ends_at: "2026-06-15T23:59:59Z",
  discount_percent: 50,
};
const DISABLED_CFG = { ...ACTIVE_CFG, enabled: false };

Deno.test("isValentinesPromoActive: active within window", () => {
  assertEquals(isValentinesPromoActive(ACTIVE_CFG, NOW), true);
});

Deno.test("isValentinesPromoActive: disabled flag", () => {
  assertEquals(isValentinesPromoActive(DISABLED_CFG, NOW), false);
});

Deno.test("isValentinesPromoActive: before start", () => {
  assertEquals(isValentinesPromoActive(ACTIVE_CFG, new Date("2026-05-30T00:00:00Z")), false);
});

Deno.test("isValentinesPromoActive: after end", () => {
  assertEquals(isValentinesPromoActive(ACTIVE_CFG, new Date("2026-06-20T00:00:00Z")), false);
});

Deno.test("validateInstallmentsForPromo: blocks 3x card during promo", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: true, installments: 3, now: NOW,
  });
  assertEquals(typeof err, "string");
});

Deno.test("validateInstallmentsForPromo: blocks 6x card during promo", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: true, installments: 6, now: NOW,
  });
  assertEquals(typeof err, "string");
});

Deno.test("validateInstallmentsForPromo: allows 1x card during promo", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: true, installments: 1, now: NOW,
  });
  assertEquals(err, null);
});

Deno.test("validateInstallmentsForPromo: allows 2x card during promo", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: true, installments: 2, now: NOW,
  });
  assertEquals(err, null);
});

Deno.test("validateInstallmentsForPromo: does not cap non-card (PIX/boleto)", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: false, installments: 6, now: NOW,
  });
  assertEquals(err, null);
});

Deno.test("validateInstallmentsForPromo: allows 6x card outside promo (disabled)", () => {
  const err = validateInstallmentsForPromo({
    cfg: DISABLED_CFG, isCard: true, installments: 6, now: NOW,
  });
  assertEquals(err, null);
});

Deno.test("validateInstallmentsForPromo: allows 6x card before promo window", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: true, installments: 6, now: new Date("2026-05-01T00:00:00Z"),
  });
  assertEquals(err, null);
});

Deno.test("validateInstallmentsForPromo: allows 6x card after promo window", () => {
  const err = validateInstallmentsForPromo({
    cfg: ACTIVE_CFG, isCard: true, installments: 6, now: new Date("2026-07-01T00:00:00Z"),
  });
  assertEquals(err, null);
});

Deno.test("validateInstallmentsForPromo: handles null config", () => {
  const err = validateInstallmentsForPromo({
    cfg: null, isCard: true, installments: 6, now: NOW,
  });
  assertEquals(err, null);
});
