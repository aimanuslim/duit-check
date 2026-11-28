/** All money is integer sen. Negative = duit keluar, positive = duit masuk. */

/** "1,234.56" -> 123456. Returns NaN if it isn't an amount. */
export function toSen(s: string): number {
  const m = /^(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  return Number(m[1].replace(/,/g, '')) * 100 + Number(m[2]);
}

const nf = new Intl.NumberFormat('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 -> "1,234.56" (no sign). */
export const fmt = (sen: number): string => nf.format(Math.abs(sen) / 100);

/** 123456 -> "RM1,234.56", -123456 -> "-RM1,234.56". */
export const rm = (sen: number): string => `${sen < 0 ? '-' : ''}RM${fmt(sen)}`;

/** User input "1,234.5" -> 123450, or NaN. */
export function parseInput(s: string): number {
  const n = Number(s.replace(/[,\s]/g, '').replace(/^RM/i, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
