const AFFILIATE_COOKIE_KEY = 'affiliate_ref';
const AFFILIATE_COOKIE_DAYS = 30;

export const saveAffiliateCode = (code: string) => {
  const expires = new Date();
  expires.setDate(expires.getDate() + AFFILIATE_COOKIE_DAYS);
  localStorage.setItem(AFFILIATE_COOKIE_KEY, JSON.stringify({ code, expires: expires.toISOString() }));
};

export const getAffiliateCode = (): string | null => {
  try {
    const raw = localStorage.getItem(AFFILIATE_COOKIE_KEY);
    if (!raw) return null;
    const { code, expires } = JSON.parse(raw);
    if (new Date(expires) < new Date()) {
      localStorage.removeItem(AFFILIATE_COOKIE_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
};

export const clearAffiliateCode = () => {
  localStorage.removeItem(AFFILIATE_COOKIE_KEY);
};

export const generateReferralCode = (name: string): string => {
  const clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${clean.substring(0, 8)}${suffix}`;
};
