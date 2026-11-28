// Pure aggregation for Overview and Zakat.
import type { Bucket, Category, Txn } from './db';

export interface Totals {
  pendapatan: number; // money in (positive)
  keperluan: number; // money out (positive number)
  kehendak: number;
  simpanan: number; // net put away
  belum: number; // uncategorised money out
  belumCount: number;
  /** money out in categories marked "tolak masa kira zakat" (any bucket) */
  tolakan: number;
}

const empty = (): Totals => ({ pendapatan: 0, keperluan: 0, kehendak: 0, simpanan: 0, belum: 0, belumCount: 0, tolakan: 0 });

export function bucketOf(t: Txn, cats: Map<string, Category>): Bucket | null {
  return cats.get(t.categoryId)?.bucket ?? null;
}

/** Spending buckets are reported as positive numbers; refunds in a category reduce it. */
export function totals(txns: Txn[], cats: Map<string, Category>): Totals {
  const r = empty();
  for (const t of txns) {
    const b = bucketOf(t, cats);
    if (b === 'pindahan') continue;
    if (cats.get(t.categoryId)?.zakatDeduct) r.tolakan -= t.amountSen;
    if (b === 'pendapatan') r.pendapatan += t.amountSen;
    else if (b) r[b] -= t.amountSen;
    else if (t.amountSen < 0) {
      r.belum -= t.amountSen;
      r.belumCount++;
    } else {
      r.belumCount++;
    }
  }
  return r;
}

export function byCategory(txns: Txn[], cats: Map<string, Category>): Array<{ category: Category | null; sen: number; count: number }> {
  const m = new Map<string, { category: Category | null; sen: number; count: number }>();
  for (const t of txns) {
    const c = cats.get(t.categoryId) ?? null;
    if (c?.bucket === 'pindahan' || c?.bucket === 'pendapatan') continue;
    if (!c && t.amountSen > 0) continue;
    const k = c?.id ?? '';
    const g = m.get(k) ?? { category: c, sen: 0, count: 0 };
    g.sen -= t.amountSen;
    g.count++;
    m.set(k, g);
  }
  return [...m.values()].filter((g) => g.sen !== 0).sort((a, b) => b.sen - a.sen);
}

export type ZakatMethod = 'tolakan' | 'tanpa';

export interface ZakatSettings {
  method: ZakatMethod;
  /** nisab in sen, per year (it changes with gold price; LZS announces it) */
  nisab: Record<string, number>;
}

export const DEFAULT_ZAKAT: ZakatSettings = { method: 'tolakan', nisab: {} };
export const ZAKAT_RATE = 0.025;

export interface ZakatResult {
  pendapatan: number;
  tolakan: number;
  /** what the 2.5% is charged on */
  base: number;
  nisab: number | null;
  wajib: boolean | null; // null = nisab not set
  zakat: number;
}

/** Dengan tolakan: 2.5% x (pendapatan - kategori bertanda tolak zakat). Tanpa tolakan: 2.5% x pendapatan. */
export function zakatFor(t: Totals, method: ZakatMethod, nisab: number | null): ZakatResult {
  const base = Math.max(0, method === 'tolakan' ? t.pendapatan - t.tolakan : t.pendapatan);
  const wajib = nisab === null ? null : base >= nisab;
  return { pendapatan: t.pendapatan, tolakan: t.tolakan, base, nisab, wajib, zakat: wajib === false ? 0 : Math.round(base * ZAKAT_RATE) };
}

export const inPeriod = (t: Txn, year: string, month?: string) => t.date.startsWith(month ? `${year}-${month}` : year);
