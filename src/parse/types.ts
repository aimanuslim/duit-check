export interface Cell {
  x: number;
  s: string;
}

/** One visual line of a PDF page, rebuilt from pdf.js text items by y position. */
export interface Line {
  page: number;
  y: number;
  cells: Cell[];
}

export type AccountKind = 'savings' | 'current' | 'credit_card' | 'investment';
export type Bank = 'maybank' | 'ambank';

export interface ParsedAccount {
  /** Stable id across statements: bank:kind:last4 */
  key: string;
  bank: Bank;
  kind: AccountKind;
  product: string;
  last4: string;
  holderRole: 'P' | 'S';
  /** key of the principal card, for supplementary cards */
  parentKey: string | null;
  openingSen: number;
  closingSen: number;
}

export interface ParsedTxn {
  accountKey: string;
  /** YYYY-MM-DD, the transaction date */
  date: string;
  description: string;
  /** Short name used for keywords/rules, e.g. "AEON CO-SHAH ALAM" */
  merchant: string;
  /** negative = keluar, positive = masuk (card charges are negative, CR is positive) */
  amountSen: number;
  balanceSen: number | null;
}

export interface Reconcile {
  accountKey: string;
  openingSen: number;
  closingSen: number;
  /** opening + sum(txns) for savings; opening - sum(txns) for cards (balance owed) */
  computedSen: number;
  ok: boolean;
}

export interface ParsedStatement {
  parserId: string;
  label: string;
  bank: Bank;
  /** YYYY-MM-DD */
  statementDate: string;
  accounts: ParsedAccount[];
  txns: ParsedTxn[];
  checks: Reconcile[];
}

export interface Parser {
  id: string;
  label: string;
  detect(lines: Line[]): boolean;
  parse(lines: Line[]): ParsedStatement;
}

export class ParseError extends Error {}
