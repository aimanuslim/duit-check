import { lineText } from './lines';
import { ParseError, type ParsedAccount, type ParsedTxn, type Parser } from './types';
import { amountCr, cleanMerchant, dmyMon, last4, reconcileCard } from './util';

const CARD = /^(.+?)\s*\((P|S)\)\s+([\d ]{15,23})$/;
const NOISE = /SUB TOTAL|PREVIOUS BALANCE|Please see|Total Current Balance|End of Transaction/i;

export const ambankCard: Parser = {
  id: 'ambank-card',
  label: 'AmBank kad kredit',
  detect: (lines) => {
    const t = lines.slice(0, 80).map(lineText).join('\n');
    return /CREDIT CARD STATEMENT \/ INVOICE/.test(t) || (/AmBank/i.test(t) && /YOUR TRANSACTION DETAILS/.test(t));
  },
  parse(lines) {
    const sd = lines.find((l) => /Statement Date/.test(lineText(l)));
    const statementDate = sd && dmyMon(sd.cells[sd.cells.length - 1].s);
    if (!statementDate) throw new ParseError('Tarikh penyata tak jumpa');

    const accounts: ParsedAccount[] = [];
    const txns: ParsedTxn[] = [];
    let cur = null as ParsedAccount | null;
    let lastP = null as ParsedAccount | null;
    let lastTxn: ParsedTxn | null = null;
    let descX = 0;

    for (const l of lines) {
      const t = lineText(l);
      const c = l.cells;
      if (/Total Current Balance|End of Transaction Details/.test(t)) break;
      const card = c.length === 1 ? CARD.exec(c[0].s) : null;
      if (card) {
        const role = card[2] as 'P' | 'S';
        const l4 = last4(card[3]);
        cur = { key: `ambank:credit_card:${l4}`, bank: 'ambank', kind: 'credit_card', product: card[1].trim(), last4: l4, holderRole: role, parentKey: role === 'S' ? (lastP?.key ?? null) : null, openingSen: 0, closingSen: 0 };
        if (role === 'P') lastP = cur;
        accounts.push(cur);
        lastTxn = null;
        continue;
      }
      if (!cur) continue;
      const amt = amountCr(c[c.length - 1].s);
      if (/PREVIOUS BALANCE/.test(t) && amt) {
        cur.openingSen = amt.cr ? -amt.sen : amt.sen;
        continue;
      }
      if (/SUB TOTAL/.test(t) && amt) {
        cur.closingSen = amt.cr ? -amt.sen : amt.sen;
        lastTxn = null;
        continue;
      }
      const d1 = c.length >= 4 ? dmyMon(c[0].s) : null;
      if (d1 && dmyMon(c[1].s) && amt) {
        descX = c[2].x;
        const desc = c.slice(2, -1).map((x) => x.s);
        lastTxn = { accountKey: cur.key, date: d1, description: desc.join(' '), merchant: cleanMerchant(desc[0].split(' - THANK YOU')[0]), amountSen: amt.cr ? amt.sen : -amt.sen, balanceSen: null };
        txns.push(lastTxn);
        continue;
      }
      if (lastTxn && !amt && Math.abs(c[0].x - descX) < 3 && !NOISE.test(t)) lastTxn.description += ' ' + c.map((x) => x.s).join(' ');
    }
    if (!accounts.length) throw new ParseError('Takde kad dalam statement ni');
    const checks = accounts.map((acc) => reconcileCard(acc, txns.filter((t) => t.accountKey === acc.key).reduce((s, t) => s + t.amountSen, 0)));
    return { parserId: this.id, label: 'AmBank kad kredit', bank: 'ambank', statementDate, accounts, txns, checks };
  },
};
