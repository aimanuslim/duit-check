import { ambankCard } from './ambank-card';
import { maybankCard } from './maybank-card';
import { maybankSavings } from './maybank-savings';
import { ParseError, type Line, type ParsedStatement, type Parser } from './types';

/** Add new banks / investment accounts here. Order matters only if two detect() match. */
export const PARSERS: Parser[] = [maybankSavings, maybankCard, ambankCard];

export function parseLines(lines: Line[]): ParsedStatement {
  const p = PARSERS.find((x) => x.detect(lines));
  if (!p) throw new ParseError('Format statement ni aku tak kenal lagi (Maybank simpanan / kad, AmBank kad je buat masa ni).');
  return p.parse(lines);
}

/** Same statement uploaded twice (even as a re-downloaded file) gets the same key. */
export const statementKey = (s: ParsedStatement) => `${s.parserId}|${s.statementDate}|${s.accounts.map((a) => a.key).sort().join(',')}`;

export { ParseError };
