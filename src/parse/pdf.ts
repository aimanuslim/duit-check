// Browser-only: loads pdf.js lazily (big) with its bundled worker. No network.
import { itemsToLines, type RawItem } from './lines';
import type { Line } from './types';

export class PasswordNeeded extends Error {}

export async function pdfToLines(data: ArrayBuffer, password?: string): Promise<Line[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: workerSrc } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  const task = pdfjs.getDocument({ data: new Uint8Array(data), password, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    if ((e as Error).name === 'PasswordException') throw new PasswordNeeded(password ? 'Password salah' : 'PDF ni berpassword');
    throw e;
  }
  const lines: Line[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const items: RawItem[] = [];
    for (const it of tc.items) if ('str' in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
    lines.push(...itemsToLines(p, items));
  }
  await task.destroy();
  return lines;
}
