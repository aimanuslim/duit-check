import { toSen } from '../money';
import { lineText } from './lines';
import { ParseError, type Line, type ParsedAccount, type ParsedTxn, type Parser } from './types';
import { cleanMerchant, dmySlash, findLine, last4 } from './util';

const AMT = /^([\d,]+\.\d{2})([+-])$/;
const BAL = /^([\d,]+\.\d{2})(-)?$/;
/** Continuation lines that are really page furniture. */
const NOISE = /ENDING BALANCE|TOTAL (CREDIT|DEBIT)|BEGINNING BALANCE|URUSNIAGA|PIDM|Perhation/i;
/** A reference code rather than a name: "5YEWNR4Z2DJP *", "d44cbf07-0c90-4f40-" */
const CODE = /^(?=.*\d)[A-Za-z0-9-]{10,}\s*\*?$/;

export const maybankSavings: Parser = {
  id: 'maybank-savings',
  label: 'Maybank akaun simpanan/semasa',
  detect: (lines) => {
    const t = lines.slice(0, 40).map(lineText).join('\n');
    return /ACCOUNT TRANSACTIONS/.test(t) && /STATEMENT BALANCE/.test(t) && /Maybank/i.test(t);
  },
  parse(lines) {
    const begin = lines.findIndex((l) => /BEGINNING BALANCE/.test(lineText(l)));
    if (begin < 0) throw new ParseError('Takde BEGINNING BALANCE');
    const dateCell = lines
      .slice(0, begin)
      .flatMap((l) => l.cells)
      .find((c) => dmySlash(c.s));
    const statementDate = dateCell && dmySlash(dateCell.s);
    if (!statementDate) throw new ParseError('Tarikh penyata tak jumpa');
    const accNo = lines.map(lineText).join('\n').match(/\b(\d{6}-\d{6})\b/)?.[1];
    if (!accNo) throw new ParseError('Nombor akaun tak jumpa');
    const pidm = findLine(lines, /PIDM/);
    const product = pidm && pidm.cells.length > 1 ? pidm.cells[pidm.cells.length - 1].s : 'Maybank';
    const opening = toSen(lines[begin].cells[lines[begin].cells.length - 1].s);

    const key = `maybank:${/CURRENT/i.test(product) ? 'current' : 'savings'}:${last4(accNo)}`;
    const txns: (ParsedTxn & { extra: string[] })[] = [];
    let descX = 0;
    let lastBalance = opening;
    let balanceOk = true;

    for (const l of lines.slice(begin + 1)) {
      const c = l.cells;
      const date = c.length >= 4 ? dmySlash(c[0].s) : null;
      const a = c.length >= 4 ? AMT.exec(c[c.length - 2].s) : null;
      const b = c.length >= 4 ? BAL.exec(c[c.length - 1].s) : null;
      if (date && a && b) {
        const amountSen = toSen(a[1]) * (a[2] === '-' ? -1 : 1);
        const balanceSen = toSen(b[1]) * (b[2] ? -1 : 1);
        if (lastBalance + amountSen !== balanceSen) balanceOk = false;
        lastBalance = balanceSen;
        descX = c[1].x;
        txns.push({ accountKey: key, date, description: c.slice(1, -2).map((x) => x.s).join(' '), merchant: '', amountSen, balanceSen, extra: [] });
        continue;
      }
      const cur = txns[txns.length - 1];
      const t = lineText(l);
      if (cur && c[0].x >= descX - 1 && c[0].x <= descX + 20 && !NOISE.test(t)) cur.extra.push(c.map((x) => x.s).join(' '));
    }

    const endLine = findLine(lines, /ENDING BALANCE/);
    const closing = endLine ? toSen(endLine.cells[endLine.cells.length - 1].s.replace(/-$/, '')) : lastBalance;
    const out: ParsedTxn[] = txns.map(({ extra, ...t }) => {
      const who = extra.find((e) => !CODE.test(e) && /[A-Za-z]{3}/.test(e)) ?? t.description;
      return { ...t, description: [t.description, ...extra].join(' · '), merchant: cleanMerchant(who) };
    });
    const acc: ParsedAccount = { key, bank: 'maybank', kind: key.split(':')[1] as 'savings', product, last4: last4(accNo), holderRole: 'P', parentKey: null, openingSen: opening, closingSen: closing };
    const computedSen = opening + out.reduce((s, t) => s + t.amountSen, 0);
    return {
      parserId: this.id,
      label: `Maybank ${product}`,
      bank: 'maybank',
      statementDate,
      accounts: [acc],
      txns: out,
      checks: [{ accountKey: key, openingSen: opening, closingSen: closing, computedSen, ok: balanceOk && computedSen === closing }],
    };
  },
};

export type { Line };
