import { toSen } from '../money';
import type { Line, ParsedAccount, Reconcile } from './types';
import { lineText } from './lines';

export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const p2 = (n: number) => String(n).padStart(2, '0');
export const iso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;

/** "28 OCT 26" -> "2026-10-28" */
export function dmyMon(s: string): string | null {
  const m = /^(\d{2}) ([A-Z]{3}) (\d{2})$/.exec(s.trim().toUpperCase());
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2]) + 1;
  return mon ? iso(2000 + Number(m[3]), mon, Number(m[1])) : null;
}

/** "31/10/26" -> "2026-10-31" */
export function dmySlash(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s.trim());
  return m ? iso(2000 + Number(m[3]), Number(m[2]), Number(m[1])) : null;
}

/** "29/12" on a statement dated 2027-01-28 -> "2026-12-29" (month after the statement month = last year). */
export function dmNoYear(s: string, statementDate: string): string | null {
  const m = /^(\d{2})\/(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [sy, sm] = statementDate.split('-').map(Number);
  const mon = Number(m[2]);
  return iso(mon > sm ? sy - 1 : sy, mon, Number(m[1]));
}

/** Amount cell with optional credit marker: "2,864.59 CR" / "329.25CR" -> { sen, cr } */
export function amountCr(s: string): { sen: number; cr: boolean } | null {
  const m = /^([\d,]+\.\d{2})\s?(CR)?$/.exec(s.trim());
  if (!m) return null;
  const sen = toSen(m[1]);
  return Number.isNaN(sen) ? null : { sen, cr: !!m[2] };
}

export const last4 = (digits: string) => digits.replace(/\D/g, '').slice(-4);

export const findLine = (lines: Line[], re: RegExp) => lines.find((l) => re.test(lineText(l)));

/** Card balances are amounts owed: closing = opening + charges - credits = opening - sum(signed txns). */
export function reconcileCard(acc: ParsedAccount, sumSen: number): Reconcile {
  const computedSen = acc.openingSen - sumSen;
  return { accountKey: acc.key, openingSen: acc.openingSen, closingSen: acc.closingSen, computedSen, ok: computedSen === acc.closingSen };
}

/** Cleans a merchant string into a stable keyword: uppercase, no trailing refs/asterisks. */
export function cleanMerchant(s: string): string {
  return s
    .toUpperCase()
    .replace(/\*/g, ' ')
    .replace(/\b\d+(ST|ND|RD|TH)\/\d+\b.*$/, '') // instalment "11th/12 (RM166)"
    .replace(/(\s+\d{5,})+\s*$/, '') // trailing reference numbers
    .replace(/\s+AP$/, '') // Maybank card channel marker
    .replace(/\s+/g, ' ')
    .trim();
}
