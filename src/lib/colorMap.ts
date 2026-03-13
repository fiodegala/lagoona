export const COLOR_MAP: Record<string, string> = {
  preto: '#000000', black: '#000000',
  branco: '#FFFFFF', white: '#FFFFFF',
  vermelho: '#EF4444', red: '#EF4444',
  azul: '#3B82F6', blue: '#3B82F6',
  verde: '#22C55E', green: '#22C55E',
  amarelo: '#EAB308', yellow: '#EAB308',
  rosa: '#EC4899', pink: '#EC4899',
  roxo: '#A855F7', purple: '#A855F7',
  laranja: '#F97316', orange: '#F97316',
  marrom: '#92400E', brown: '#92400E',
  cinza: '#6B7280', gray: '#6B7280', grey: '#6B7280',
  bege: '#D2B48C', beige: '#D2B48C',
  nude: '#E8C4A2',
  dourado: '#D4AF37', gold: '#D4AF37',
  prata: '#C0C0C0', silver: '#C0C0C0',
  vinho: '#722F37', burgundy: '#722F37',
  navy: '#1E3A5F', marinho: '#1E3A5F',
  coral: '#FF7F50',
  creme: '#FFFDD0',
  caramelo: '#C68E17',
  terracota: '#E2725B',
  mostarda: '#FFDB58',
  oliva: '#808000', olive: '#808000',
  turquesa: '#40E0D0',
  lavanda: '#E6E6FA',
  lilás: '#C8A2C8',
  salmão: '#FA8072',
  'off white': '#FAF9F6',
  'azul marinho': '#1E3A5F',
  'azul bic': '#0066FF',
  'azul sky': '#87CEEB',
  marsala: '#964B50',
  grafite: '#474747',
};

export const LIGHT_COLORS = ['#FFFFFF', '#FAF9F6', '#FFFDD0', '#E6E6FA', '#E8C4A2', '#87CEEB'];

export function getColorHex(colorName: string): string | null {
  const hex = COLOR_MAP[colorName.toLowerCase().trim()];
  return hex || null;
}

export function isLightColor(hex: string): boolean {
  return LIGHT_COLORS.includes(hex);
}
