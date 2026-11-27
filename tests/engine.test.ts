import { describe, expect, it } from 'vitest';
import { TRANSFER_CATEGORY_ID, type Account, type Category, type Rule, type Txn } from '../src/db';
import { findTransferPairs, keywordGroups, matchRule, recategorize, suggestCategory } from '../src/engine';
import { totals, zakatFor } from '../src/report';

const acc = (id: string, kind: Account['kind']): Account => ({ id, bank: 'maybank', kind, name: id, product: id, last4: '0000', holderRole: 'P', parentId: null, createdAt: 0, updatedAt: 0 });
let n = 0;
const tx = (p: Partial<Txn>): Txn => ({ id: `t${n++}`, statementId: 's', accountId: 'sav', date: '2026-10-01', description: '', merchant: '', amountSen: 0, balanceSen: null, categoryId: '', catSource: '', transferPairId: null, note: '', createdAt: 0, updatedAt: 0, ...p });
const rule = (keyword: string, categoryId: string): Rule => ({ id: keyword, keyword, categoryId, createdAt: 0, updatedAt: 0 });
const accounts = [acc('sav', 'savings'), acc('card', 'credit_card')];

describe('rules', () => {
  it('longest keyword wins', () => {
    const rules = [rule('AEON', 'shop'), rule('AEON CREDIT', 'hutang')];
    expect(matchRule({ description: 'FPX · AEON CREDIT SERVICE', merchant: '' }, rules)?.categoryId).toBe('hutang');
  });
});

describe('transfer pairing', () => {
  it('pairs savings -> card payment within 4 days, not across 10 days', () => {
    const out = tx({ accountId: 'sav', amountSen: -32925, date: '2026-10-01' });
    const inn = tx({ accountId: 'card', amountSen: 32925, date: '2026-10-02' });
    const far = tx({ accountId: 'card', amountSen: 1000, date: '2026-10-20' });
    const farOut = tx({ accountId: 'sav', amountSen: -1000, date: '2026-10-01' });
    const p = findTransferPairs([out, inn, far, farOut], accounts);
    expect(p.get(out.id)).toBe(inn.id);
    expect(p.has(far.id)).toBe(false);
  });
});

describe('recategorize', () => {
  it('manual > transfer > rule, and reports only changes', () => {
    const manual = tx({ description: 'TNB', categoryId: 'shop', catSource: 'manual' });
    const ruled = tx({ description: 'MY TNB-EC', accountId: 'card', amountSen: -100 });
    const out = tx({ amountSen: -500, description: 'PYMT FROM A/C' });
    const inn = tx({ accountId: 'card', amountSen: 500, description: 'PYMT@MAYBANK2U' });
    const changed = recategorize([manual, ruled, out, inn], accounts, [rule('TNB', 'bil')]);
    const by = new Map(changed.map((t) => [t.id, t]));
    expect(by.has(manual.id)).toBe(false);
    expect(by.get(ruled.id)).toMatchObject({ categoryId: 'bil', catSource: 'rule' });
    expect(by.get(out.id)).toMatchObject({ categoryId: TRANSFER_CATEGORY_ID, transferPairId: inn.id });
    expect(recategorize([manual, ...changed], accounts, [rule('TNB', 'bil')])).toEqual([]);
  });
  it('suggests from hand-picked similar txns and groups keywords', () => {
    const a = tx({ merchant: 'FOODPANDA', categoryId: 'makan', amountSen: -100 });
    const b = tx({ merchant: 'FOODPANDA', amountSen: -200 });
    expect(suggestCategory(b, [a, b])).toEqual({ categoryId: 'makan', count: 1 });
    expect(keywordGroups([a, b])[0]).toMatchObject({ keyword: 'FOODPANDA', count: 2, totalSen: -300 });
  });
});

describe('zakat (dengan tolakan)', () => {
  const cat = (id: string, bucket: Category['bucket']): Category => ({ id, name: id, emoji: '', bucket, order: 0, createdAt: 0, updatedAt: 0 });
  const cats = new Map([cat('gaji', 'pendapatan'), cat('bil', 'keperluan'), cat('fun', 'kehendak'), cat(TRANSFER_CATEGORY_ID, 'pindahan')].map((c) => [c.id, c]));
  const t = totals(
    [
      tx({ categoryId: 'gaji', amountSen: 1_000_000 }),
      tx({ categoryId: 'bil', amountSen: -300_000 }),
      tx({ categoryId: 'bil', amountSen: 10_000 }), // refund reduces keperluan
      tx({ categoryId: 'fun', amountSen: -200_000 }),
      tx({ categoryId: TRANSFER_CATEGORY_ID, amountSen: -999_999 }),
      tx({ amountSen: -5_000 }),
    ],
    cats,
  );
  it('totals by bucket, ignores pindahan', () => {
    expect(t).toMatchObject({ pendapatan: 1_000_000, keperluan: 290_000, kehendak: 200_000, belum: 5_000, belumCount: 1 });
  });
  it('2.5% of pendapatan - keperluan; leisure is NOT deducted', () => {
    expect(zakatFor(t, 'tolakan', null)).toMatchObject({ base: 710_000, zakat: 17_750, wajib: null });
    expect(zakatFor(t, 'tanpa', null).zakat).toBe(25_000);
    expect(zakatFor(t, 'tolakan', 2_000_000)).toMatchObject({ wajib: false, zakat: 0 });
  });
});
