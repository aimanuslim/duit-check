import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { BUCKETS, BUCKET_LABEL, listAccounts, listCategories, listRules, listTxns, type Account, type Category, type Rule, type Txn } from './db';
import { rm } from './money';

export const nav = (path: string) => {
  location.hash = path;
};

export function useRoute(): string {
  const get = () => location.hash.replace(/^#/, '') || '/';
  const [r, setR] = useState(get);
  useEffect(() => {
    const f = () => setR(get());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): [T | undefined, () => void] {
  const [v, setV] = useState<T>();
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    fn().then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, [...deps, n]);
  return [v, useCallback(() => setN((x) => x + 1), [])];
}

export interface AllData {
  txns: Txn[];
  cats: Category[];
  catMap: Map<string, Category>;
  accounts: Account[];
  accMap: Map<string, Account>;
  rules: Rule[];
}

export function useData(): [AllData | undefined, () => void] {
  return useAsync(async () => {
    const [txns, cats, accounts, rules] = await Promise.all([listTxns(), listCategories(), listAccounts(), listRules()]);
    return { txns, cats, catMap: new Map(cats.map((c) => [c.id, c])), accounts, accMap: new Map(accounts.map((a) => [a.id, a])), rules };
  });
}

/** Small UI prefs (selected year etc.). Not user data, so localStorage is fine. */
export function usePref<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(`dc:${key}`);
      return s ? (JSON.parse(s) as T) : init;
    } catch {
      return init;
    }
  });
  return [
    v,
    (x: T) => {
      setV(x);
      try {
        localStorage.setItem(`dc:${key}`, JSON.stringify(x));
      } catch {
        /* private mode */
      }
    },
  ];
}

export function Header(props: { title: string; back?: string; action?: ComponentChildren }) {
  return (
    <header class="top">
      {props.back && (
        <a class="icon-btn" href={`#${props.back}`} aria-label="Back">
          ‹
        </a>
      )}
      <h1>{props.title}</h1>
      <div class="top-action">{props.action}</div>
    </header>
  );
}

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title}>
        <div class="sheet-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" aria-label="Tutup" onClick={props.onClose}>
            ×
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Toast(props: { text: string; action?: { label: string; run: () => void }; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(props.onDone, 6000);
    return () => clearTimeout(id);
  }, [props.text]);
  return (
    <div class="toast" role="status">
      <span>{props.text}</span>
      {props.action && (
        <button class="btn small ghost" onClick={props.action.run}>
          {props.action.label}
        </button>
      )}
    </div>
  );
}

export const Money = ({ sen, plain }: { sen: number; plain?: boolean }) => <span class={`money ${plain ? '' : sen < 0 ? 'out' : 'in'}`}>{rm(sen)}</span>;

export const catLabel = (c: Category | undefined | null) => (c ? `${c.emoji} ${c.name}` : '❓ Belum kategori');

/** Grid of categories grouped by bucket. */
export function CategoryPicker(props: { cats: Category[]; value: string; onPick: (id: string) => void }) {
  return (
    <div class="picker">
      {BUCKETS.map((b) => {
        const list = props.cats.filter((c) => c.bucket === b);
        if (!list.length) return null;
        return (
          <div key={b}>
            <p class={`bucket-title b-${b}`}>{BUCKET_LABEL[b]}</p>
            <div class="chips">
              {list.map((c) => (
                <button key={c.id} class={`chip-btn ${c.id === props.value ? 'on' : ''}`} onClick={() => props.onPick(c.id)}>
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export const monthName = (mm: string) => MONTHS[Number(mm) - 1] ?? mm;
export const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${monthName(iso.slice(5, 7))}`;

/** Year + month (or whole year) selector driven by the years present in the data. */
export function PeriodPicker(props: { years: string[]; year: string; month: string; onChange: (year: string, month: string) => void }) {
  return (
    <div class="row gap period">
      <select value={props.year} onChange={(e) => props.onChange((e.target as HTMLSelectElement).value, props.month)} aria-label="Tahun">
        {props.years.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <select value={props.month} onChange={(e) => props.onChange(props.year, (e.target as HTMLSelectElement).value)} aria-label="Bulan">
        <option value="">Setahun</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}

export const yearsOf = (txns: Txn[]) => {
  const ys = [...new Set(txns.map((t) => t.date.slice(0, 4)))].sort().reverse();
  return ys.length ? ys : [String(new Date().getFullYear())];
};

export const Empty = ({ children }: { children: ComponentChildren }) => <div class="empty">{children}</div>;
