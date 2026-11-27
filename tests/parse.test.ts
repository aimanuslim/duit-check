import { describe, expect, it } from 'vitest';
import { parseLines, statementKey } from '../src/parse';
import { itemsToLines, lineText } from '../src/parse/lines';
import { cleanMerchant, dmNoYear } from '../src/parse/util';
import { ambankCardLines, maybankCardLines, maybankSavingsLines } from './fixtures';

describe('lines', () => {
  it('groups items by y, splits cells on big x gaps, merges close ones', () => {
    const lines = itemsToLines(1, [
      { str: '100.00-', x: 365, y: 576.2, w: 27 },
      { str: '01/10/26', x: 43, y: 576, w: 32 },
      { str: 'FPX PAYMENT', x: 87, y: 576, w: 40 },
      { str: 'FR A/', x: 128.5, y: 576, w: 10 },
      { str: 'next', x: 95, y: 560, w: 10 },
    ]);
    expect(lines.map(lineText)).toEqual(['01/10/26  FPX PAYMENT FR A/  100.00-', 'next']);
  });
});

describe('util', () => {
  it('infers year across Dec/Jan', () => {
    expect(dmNoYear('29/12', '2027-01-28')).toBe('2026-12-29');
    expect(dmNoYear('05/01', '2027-01-28')).toBe('2027-01-05');
  });
  it('cleans merchants', () => {
    expect(cleanMerchant('PRUBSN-RPS 8701546616')).toBe('PRUBSN-RPS');
    expect(cleanMerchant('XIAOMI 11th/12 (RM166)')).toBe('XIAOMI');
    expect(cleanMerchant('Decathlon Malaysia Sdn AP')).toBe('DECATHLON MALAYSIA SDN');
  });
});

describe('maybank savings', () => {
  const s = parseLines(maybankSavingsLines);
  it('reads header + reconciles', () => {
    expect(s.parserId).toBe('maybank-savings');
    expect(s.statementDate).toBe('2026-10-31');
    expect(s.accounts[0]).toMatchObject({ key: 'maybank:savings:1234', product: 'PERSONAL SAVER-i', openingSen: 100000, closingSen: 565000 });
    expect(s.checks[0].ok).toBe(true);
  });
  it('attaches continuation lines, even across a page break, and picks a name not a ref code', () => {
    expect(s.txns.map((t) => [t.amountSen, t.merchant])).toEqual([
      [-10000, 'SYARIKAT AIR CONTOH'],
      [-25000, 'VISA ISLAMIC'],
      [500000, 'SYARIKAT GAJI SDN'],
    ]);
    expect(s.txns[1].description).toBe('PYMT FROM A/C · VISA ISLAMIC * · XXXX-XXXX-XXXX-9999');
  });
});

describe('maybank card', () => {
  const s = parseLines(maybankCardLines);
  it('parses rows, skips the no-amount profit line, signs CR as money in', () => {
    expect(s.parserId).toBe('maybank-card');
    expect(s.statementDate).toBe('2027-01-28');
    expect(s.txns.map((t) => [t.date, t.amountSen])).toEqual([
      ['2026-12-28', -5724],
      ['2027-01-02', 25000],
      ['2027-01-04', 500],
    ]);
    expect(s.accounts[0]).toMatchObject({ key: 'maybank:credit_card:9999', openingSen: 25000, closingSen: 5224 });
    expect(s.checks[0].ok).toBe(true);
  });
});

describe('ambank card', () => {
  const s = parseLines(ambankCardLines);
  it('splits P and S cards across pages and links the supplementary', () => {
    expect(s.accounts.map((a) => [a.key, a.holderRole, a.parentKey])).toEqual([
      ['ambank:credit_card:1111', 'P', null],
      ['ambank:credit_card:2222', 'S', 'ambank:credit_card:1111'],
    ]);
    expect(s.checks.every((c) => c.ok)).toBe(true);
    expect(s.txns).toHaveLength(4); // rewards table after Total Current Balance ignored
  });
  it('joins wrapped description lines', () => {
    expect(s.txns[0].description).toBe('PAYMENT VIA RPP RECEIVED - THANK YOU,ALI BIN ABU,sept26,');
    expect(s.txns[0].merchant).toBe('PAYMENT VIA RPP RECEIVED');
  });
  it('same statement -> same key (dedupe)', () => {
    expect(statementKey(parseLines(ambankCardLines))).toBe(statementKey(s));
  });
});

describe('detect', () => {
  it('rejects unknown formats', () => {
    expect(() => parseLines([{ page: 1, y: 1, cells: [{ x: 0, s: 'hello' }] }])).toThrow(/tak kenal/);
  });
});
