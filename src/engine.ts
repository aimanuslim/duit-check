// Pure categorisation logic. No IndexedDB here so it's easy to test.
import { TRANSFER_CATEGORY_ID, type Account, type Rule, type Txn } from './db';

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;

/** Longest matching keyword wins, so "AEON CREDIT" beats "AEON CO" beats "AEON". */
export function matchRule(t: Pick<Txn, 'description' | 'merchant'>, rules: Rule[]): Rule | undefined {
  const hay = `${t.description} ${t.merchant}`.toUpperCase();
  let best: Rule | undefined;
  for (const r of rules) if (hay.includes(r.keyword) && (!best || r.keyword.length > best.keyword.length)) best = r;
  return best;
}

/**
 * Pair money leaving one account with the same amount arriving in another of your accounts
 * within 4 days, where at least one side is a credit card (paying your card from savings).
 * Returns txn id -> partner id for new pairs only.
 */
export function findTransferPairs(txns: Txn[], accounts: Account[]): Map<string, string> {
  const kind = new Map(accounts.map((a) => [a.id, a.kind]));
  const free = txns.filter((t) => !t.transferPairId && t.catSource !== 'manual');
  const outs = free.filter((t) => t.amountSen < 0);
  const ins = free.filter((t) => t.amountSen > 0);
  const pairs = new Map<string, string>();
  for (const o of outs) {
    let best: Txn | undefined;
    for (const i of ins) {
      if (pairs.has(i.id) || i.accountId === o.accountId || i.amountSen !== -o.amountSen) continue;
      if (kind.get(i.accountId) !== 'credit_card' && kind.get(o.accountId) !== 'credit_card') continue;
      if (days(i.date, o.date) > 4) continue;
      if (!best || days(i.date, o.date) < days(best.date, o.date)) best = i;
    }
    if (best) {
      pairs.set(o.id, best.id);
      pairs.set(best.id, o.id);
    }
  }
  return pairs;
}

/**
 * Recompute category for every txn that wasn't set by hand. Returns only the txns that changed.
 * Order: manual > transfer pair > rule > belum kategori.
 */
export function recategorize(txns: Txn[], accounts: Account[], rules: Rule[], now = Date.now()): Txn[] {
  const pairs = findTransferPairs(txns, accounts);
  const changed: Txn[] = [];
  for (const t of txns) {
    if (t.catSource === 'manual') continue;
    const pair = t.transferPairId ?? pairs.get(t.id) ?? null;
    let next: Pick<Txn, 'categoryId' | 'catSource' | 'transferPairId'>;
    if (pair) next = { categoryId: TRANSFER_CATEGORY_ID, catSource: 'transfer', transferPairId: pair };
    else {
      const r = matchRule(t, rules);
      next = r ? { categoryId: r.categoryId, catSource: 'rule', transferPairId: null } : { categoryId: '', catSource: '', transferPairId: null };
    }
    if (next.categoryId !== t.categoryId || next.catSource !== t.catSource || next.transferPairId !== t.transferPairId) changed.push({ ...t, ...next, updatedAt: now });
  }
  return changed;
}

/** Most common category among your hand-picked txns with the same merchant. */
export function suggestCategory(t: Txn, txns: Txn[]): { categoryId: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const x of txns) if (x.id !== t.id && x.merchant === t.merchant && x.categoryId && x.catSource !== 'transfer') counts.set(x.categoryId, (counts.get(x.categoryId) ?? 0) + 1);
  let best: { categoryId: string; count: number } | null = null;
  for (const [categoryId, count] of counts) if (!best || count > best.count) best = { categoryId, count };
  return best;
}

export interface KeywordGroup {
  keyword: string;
  count: number;
  totalSen: number;
  sample: string;
}

/** Group txns by merchant so you can turn the frequent ones into rules. Biggest spend first. */
export function keywordGroups(txns: Txn[]): KeywordGroup[] {
  const m = new Map<string, KeywordGroup>();
  for (const t of txns) {
    if (!t.merchant) continue;
    const g = m.get(t.merchant) ?? { keyword: t.merchant, count: 0, totalSen: 0, sample: t.description };
    g.count++;
    g.totalSen += t.amountSen;
    m.set(t.merchant, g);
  }
  return [...m.values()].sort((a, b) => Math.abs(b.totalSen) - Math.abs(a.totalSen) || b.count - a.count);
}
