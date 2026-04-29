export const getBrazilianHolidays = (year: number): Set<string> => {
  const fixedHolidays = [
    `${year}-01-01`,
    `${year}-04-21`,
    `${year}-05-01`,
    `${year}-09-07`,
    `${year}-10-12`,
    `${year}-11-02`,
    `${year}-11-15`,
    `${year}-12-25`,
  ];

  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return new Set([
    ...fixedHolidays,
    ...[-48, -47, -2, 60].map(offset => formatDate(addDays(easter, offset))),
  ]);
};

export const getBusinessDays = (date: Date, mode: 'remaining' | 'month'): number => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const firstDay = mode === 'remaining' ? date.getDate() : 1;
  const holidays = getBrazilianHolidays(year);

  let count = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    const current = new Date(year, month, day);
    if (current.getDay() === 0) continue;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (holidays.has(dateStr)) continue;
    count++;
  }

  return Math.max(count, 1);
};

export const calculateDailyGoalTarget = ({
  monthlyTarget,
  monthTotal,
  configuredDailyTarget,
  date = new Date(),
}: {
  monthlyTarget: number;
  monthTotal: number;
  configuredDailyTarget: number;
  date?: Date;
}) => {
  const remainingDays = getBusinessDays(date, 'remaining');
  const businessDaysInMonth = getBusinessDays(date, 'month');
  const monthlyRemaining = Math.max(monthlyTarget - monthTotal, 0);
  const dynamicTarget = monthlyTarget > 0 ? monthlyRemaining / remainingDays : 0;
  const target = dynamicTarget > 0 ? dynamicTarget : configuredDailyTarget;

  return {
    target,
    remainingDays,
    businessDaysInMonth,
    monthlyRemaining,
    dynamicTarget,
    calculationSource: dynamicTarget > 0
      ? 'Saldo da meta mensal dividido pelos dias úteis restantes'
      : 'Meta diária cadastrada',
  };
};