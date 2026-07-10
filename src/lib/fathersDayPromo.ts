// Campanha Dia dos Pais - ativa a partir de 13/07/2026 até 10/08/2026 (dia seguinte ao Dia dos Pais BR)
const START = new Date('2026-07-10T00:00:00-03:00').getTime();
const END = new Date('2026-08-11T00:00:00-03:00').getTime();

export const isFathersDayActive = (now: number = Date.now()): boolean => {
  return now >= START && now < END;
};
