import { lineText } from './lines';
import { ParseError, type ParsedAccount, type ParsedTxn, type Parser } from './types';
import { amountCr, cleanMerchant, dmNoYear, dmyMon, findLine, last4, reconcileCard } from './util';

const CARD = /^(.+?)\s+:\s+([\d ]{12,})$/;

export const maybankCard: Parser = {
  id: 'maybank-card',
  label: 'Maybank kad kredit',
  detect: (lines) => {
    const t = lines.slice(0, 30).map(lineText).join('\n');
    return /STATEMENT OF CREDIT CARD ACCOUNT/.test(t) && /Maybank/i.test(t);
  },
  parse(lines) {
    const dl = lines.find((l) => l.page === 1 && l.cells.some((c) => dmyMon(c.s)));
    const statementDate = dl && dmyMon(dl.cells.find((c) => dmyMon(c.s))!.s);
    if (!statementDate) throw new ParseError('Tarikh penyata tak jumpa');

    const accounts: ParsedAccount[] = [];
    const txns: ParsedTxn[] = [];
    let cur: ParsedAccount | null = null;

    for (const l of lines) {
      const t = lineText(l);
      const c = l.cells;
      const card = CARD.exec(c.map((x) => x.s).join(' '));
      if (card && c.some((x) => x.s === ':')) {
        const l4 = last4(card[2]);
        cur = { key: `maybank:credit_card:${l4}`, bank: 'maybank', kind: 'credit_card', product: card[1].trim(), last4: l4, holderRole: 'P', parentKey: null, openingSen: 0, closingSen: 0 };
        accounts.push(cur);
        continue;
      }
      if (!cur) continue;
      if (/YOUR PREVIOUS STATEMENT BALANCE/.test(t)) {
        const a = amountCr(c[c.length - 1].s);
        if (a) cur.openingSen = a.cr ? -a.sen : a.sen;
        continue;
      }
      if (/SUB TOTAL/.test(t)) {
        const a = amountCr(c[c.length - 1].s);
        if (a) cur.closingSen = a.cr ? -a.sen : a.sen;
        continue;
      }
      if (c.length >= 3 && /^\d{2}\/\d{2}$/.test(c[0].s) && /^\d{2}\/\d{2}$/.test(c[1].s)) {
        const a = amountCr(c[c.length - 1].s);
        if (!a) continue; // "RTL PROFIT CHRG RATE 15.00%" has no amount
        const date = dmNoYear(c[1].s, statementDate)!;
        const desc = c.slice(2, -1).map((x) => x.s);
        txns.push({ accountKey: cur.key, date, description: desc.join(' '), merchant: cleanMerchant(desc[0]), amountSen: a.cr ? a.sen : -a.sen, balanceSen: null });
      }
    }
    if (!accounts.length) throw new ParseError('Takde kad dalam statement ni');
    if (!findLine(lines, /SUB TOTAL/)) throw new ParseError('SUB TOTAL tak jumpa');
    const checks = accounts.map((acc) => reconcileCard(acc, txns.filter((t) => t.accountKey === acc.key).reduce((s, t) => s + t.amountSen, 0)));
    return { parserId: this.id, label: `Maybank kad (${accounts.map((a) => a.product).join(' + ')})`, bank: 'maybank', statementDate, accounts, txns, checks };
  },
};
