import type { Cell, Line } from './types';

export interface RawItem {
  str: string;
  x: number;
  y: number;
  w: number;
}

/**
 * pdf.js gives text items in content-stream order, which is not reading order
 * (headers can come after a page's rows). Rebuild lines by y, then cells by x gaps.
 */
export function itemsToLines(page: number, items: RawItem[], yTol = 2.5): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: RawItem[][] = [];
  for (const it of sorted) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g[0].y - it.y) <= yTol) g.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    let end = -Infinity;
    for (const it of g) {
      const last = cells[cells.length - 1];
      const gap = it.x - end;
      if (last && gap < 3) last.s += (gap > 0.6 ? ' ' : '') + it.str;
      else cells.push({ x: it.x, s: it.str });
      end = it.x + it.w;
    }
    for (const c of cells) c.s = c.s.replace(/ﬀ/g, 'ff').replace(/\s+/g, ' ').trim();
    return { page, y: g[0].y, cells: cells.filter((c) => c.s) };
  });
}

export const lineText = (l: Line): string => l.cells.map((c) => c.s).join('  ');
