export const COLOR_MAP: Record<string, string> = {
  // Básicas
  preto: '#000000', preta: '#000000', black: '#000000',
  branco: '#FFFFFF', branca: '#FFFFFF', white: '#FFFFFF',
  vermelho: '#EF4444', vermelha: '#EF4444', red: '#EF4444',
  azul: '#3B82F6', blue: '#3B82F6',
  verde: '#22C55E', green: '#22C55E',
  amarelo: '#EAB308', amarela: '#EAB308', yellow: '#EAB308',
  rosa: '#EC4899', pink: '#EC4899',
  roxo: '#A855F7', purple: '#A855F7',
  laranja: '#F97316', orange: '#F97316',
  marrom: '#92400E', marron: '#92400E', brown: '#92400E',
  cinza: '#6B7280', gray: '#6B7280', grey: '#6B7280',

  // Tons de bege/nude/creme
  bege: '#D2B48C', beige: '#D2B48C',
  'bege claro': '#E8D5B7',
  'bege média': '#C4A87A',
  'bege médio': '#C4A87A',
  nude: '#E8C4A2',
  creme: '#FFFDD0',
  palha: '#E6D5A8',
  champagne: '#F7E7CE',
  areia: '#C2B280',
  'areia média': '#B5A370',
  'areia médio': '#B5A370',

  // Tons de marrom/café
  café: '#6F4E37',
  chocolate: '#7B3F00',
  caramelo: '#C68E17',
  cappucino: '#A67B5B',
  capppucino: '#A67B5B',
  'marrom claro': '#B8860B',
  'marron claro': '#B8860B',
  ferrugem: '#B7410E',
  telha: '#C04000',
  'terra cota': '#E2725B',
  terracota: '#E2725B',

  // Tons de azul
  'azul marinho': '#1E3A5F',
  'azul marinho (mate)': '#1E3A5F',
  'azul bic': '#0066FF',
  'azul sky': '#87CEEB',
  'azul bebe': '#89CFF0',
  'azul celeste': '#87CEEB',
  'azul céu': '#87CEEB',
  'azul anil': '#2E5090',
  'azul aníl': '#2E5090',
  'azil anil': '#2E5090',
  'azul jeans': '#4A6FA5',
  'azul carbono': '#333F48',
  'azul metálico': '#4682B4',
  'azul noite': '#191970',
  'azul piscina': '#00CED1',
  'azul listrado': '#3B82F6',
  azulada: '#3B82F6',
  navy: '#1E3A5F', marinho: '#1E3A5F',
  'marinho noite': '#0F1F3D',
  jeans: '#4A6FA5',

  // Tons de verde
  'verde militar': '#4B5320',
  'verde oliva': '#808000',
  'verde musgo': '#2E4D2E',
  'verde menta': '#98FB98',
  'verde água': '#66CDAA',
  'verde claro': '#90EE90',
  'verde abacate': '#568203',
  'verde bandeira': '#009B3A',
  'verde cana': '#4F7942',
  'verde listrado': '#22C55E',
  oliva: '#808000', olive: '#808000',
  turquesa: '#40E0D0',

  // Tons de vermelho/vinho
  vinho: '#722F37', burgundy: '#722F37',
  marsala: '#964B50',
  bordo: '#800020',
  'vermelho ferrari': '#FF2800',
  'vermelho sangue': '#8B0000',
  coral: '#FF7F50',
  salmão: '#FA8072',
  goiaba: '#EF5B5B',

  // Tons de rosa
  'rosa bebe': '#F4C2C2',
  'rosa seco': '#D4A5A5',
  fucsia: '#FF00FF',

  // Tons de roxo/lilás
  lavanda: '#E6E6FA',
  'lilás': '#C8A2C8',
  lilas: '#C8A2C8',
  'lílas': '#C8A2C8',

  // Cinza/grafite/chumbo
  'cinza claro': '#D3D3D3',
  'cinza listrada': '#9CA3AF',
  'cinza listrado': '#9CA3AF',
  grafite: '#474747',
  'gráfite': '#474747',
  chumbo: '#36454F',
  'chumbo listrado': '#36454F',

  // Neutros especiais
  gelo: '#F0F8FF',
  'off white': '#FAF9F6',
  off: '#FAF9F6',
  prata: '#C0C0C0', silver: '#C0C0C0',
  dourado: '#D4AF37', gold: '#D4AF37',
  mostarda: '#FFDB58',
  abobora: '#FF8C00',
  açaí: '#2D1B4E',
  caqui: '#C3B091', khaki: '#C3B091',
  'caqui clara': '#D4C4A0',
  'caqui escuro': '#8F7D5E',

  // Mesclas (usamos tons de cinza médio)
  mescla: '#9CA3AF',
  'mescla clara': '#C8CED6',
  'mescla claro': '#C8CED6',
  'mescla escuro': '#6B7280',

  // Tons genéricos (clara/escura/média)
  clara: '#D2B48C',
  claro: '#D2B48C',
  escura: '#5C4033',
  escuro: '#5C4033',
  média: '#A0826D',
  médio: '#A0826D',
  media: '#A0826D',
};

export const LIGHT_COLORS = [
  '#FFFFFF', '#FAF9F6', '#FFFDD0', '#E6E6FA', '#E8C4A2', '#87CEEB',
  '#F0F8FF', '#D3D3D3', '#89CFF0', '#F4C2C2', '#F7E7CE', '#E8D5B7',
  '#98FB98', '#C8CED6', '#D4C4A0',
];

export function getColorHex(colorName: string): string | null {
  const hex = COLOR_MAP[colorName.toLowerCase().trim()];
  return hex || null;
}

export function isLightColor(hex: string): boolean {
  return LIGHT_COLORS.includes(hex);
}
