// Runs only when STATEMENTS_DIR points at real PDFs on your machine. Never commit real statements.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itemsToLines, type RawItem } from '../src/parse/lines';
import { parseLines } from '../src/parse';

const dir = process.env.STATEMENTS_DIR;

describe.skipIf(!dir)('real statements', () => {
  const files = dir ? readdirSync(dir).filter((f: string) => f.toLowerCase().endsWith('.pdf')) : [];
  for (const f of files) {
    it(f, async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(join(dir!, f))), verbosity: 0 }).promise;
      const lines = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent();
        const items: RawItem[] = [];
        for (const it of tc.items) if ('str' in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
        lines.push(...itemsToLines(p, items));
      }
      const s = parseLines(lines);
      if (process.env.DUMP) console.log(JSON.stringify({ ...s, txns: s.txns.slice(0, Number(process.env.DUMP)) }, null, 1));
      console.log(f, s.parserId, s.statementDate, s.txns.length, 'txns', s.checks.map((c) => `${c.accountKey} ${c.ok ? 'OK' : `MISMATCH ${c.computedSen} vs ${c.closingSen}`}`).join('; '));
      expect(s.checks.every((c) => c.ok)).toBe(true);
    });
  }
});
