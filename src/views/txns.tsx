import { useMemo, useState } from 'preact/hooks';
import { addRule, setCategory } from '../actions';
import { updateTxn, type Txn } from '../db';
import { suggestCategory } from '../engine';
import { rm } from '../money';
import { CategoryPicker, Empty, Header, Money, Sheet, Toast, catLabel, shortDate, useData, type AllData } from '../ui';

const SOURCE: Record<Txn['catSource'], string> = { manual: 'kau set sendiri', transfer: 'auto: pindahan antara akaun kau', rule: 'auto: ikut keyword', '': '' };

export function Txns({ query }: { query: string }) {
  const q = new URLSearchParams(query);
  const [d, reload] = useData();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const cat = q.get('cat');
  const rows = useMemo(() => {
    if (!d) return [];
    const s = search.trim().toUpperCase();
    return d.txns.filter(
      (t) =>
        (!q.get('y') || t.date.startsWith(q.get('y')!)) &&
        (!q.get('m') || t.date.slice(5, 7) === q.get('m')) &&
        (!q.get('acc') || t.accountId === q.get('acc') || d.accMap.get(t.accountId)?.parentId === q.get('acc')) &&
        (!cat || (cat === 'none' ? !t.categoryId : t.categoryId === cat)) &&
        (!s || `${t.description} ${t.merchant} ${t.note}`.toUpperCase().includes(s)),
    );
  }, [d, query, search]);
  if (!d) return null;
  const title = cat ? (cat === 'none' ? '❓ Belum kategori' : catLabel(d.catMap.get(cat))) : 'Transaksi';
  const sum = rows.reduce((s, t) => s + t.amountSen, 0);
  const cur = open ? d.txns.find((t) => t.id === open) : undefined;

  return (
    <main>
      <Header title={title} back={query ? '/txns' : undefined} />
      <input class="search" type="search" placeholder="Cari… (TNB, Shopee, nota)" value={search} onInput={(e) => setSearch((e.target as HTMLInputElement).value)} />
      <p class="muted small">
        {rows.length} transaksi · jumlah {rm(sum)}
        {query && ' · '}
        {query && <a href="#/txns">buang filter</a>}
      </p>
      {!rows.length && <Empty>Takde transaksi.</Empty>}
      <ul class="list">
        {rows.slice(0, 500).map((t) => (
          <li key={t.id} class="tap txn" onClick={() => setOpen(t.id)}>
            <div class="row between">
              <strong class="ellipsis">{t.merchant || t.description}</strong>
              <Money sen={t.amountSen} />
            </div>
            <div class="row between muted small">
              <span>
                {shortDate(t.date)} · {d.accMap.get(t.accountId)?.name ?? t.accountId}
              </span>
              <span class={t.categoryId ? '' : 'warn'}>{catLabel(d.catMap.get(t.categoryId))}</span>
            </div>
          </li>
        ))}
      </ul>
      {rows.length > 500 && <p class="muted small">Tunjuk 500 je. Guna filter/cari utk kecilkan.</p>}
      {cur && (
        <TxnSheet
          t={cur}
          d={d}
          onClose={() => setOpen(null)}
          onDone={(msg) => {
            setOpen(null);
            reload();
            if (msg) setToast(msg);
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </main>
  );
}

function TxnSheet(props: { t: Txn; d: AllData; onClose: () => void; onDone: (msg?: string) => void }) {
  const { t, d } = props;
  const similar = d.txns.filter((x) => x.id !== t.id && x.merchant && x.merchant === t.merchant && x.catSource !== 'manual').length;
  const [keyword, setKeyword] = useState(t.merchant);
  const [makeRule, setMakeRule] = useState(similar > 0);
  const [note, setNote] = useState(t.note);
  const sug = !t.categoryId ? suggestCategory(t, d.txns) : null;
  const acc = d.accMap.get(t.accountId);

  const pick = async (categoryId: string) => {
    await setCategory(t.id, categoryId);
    if (note !== t.note) await updateTxn(t.id, { note: note.trim() });
    if (categoryId && makeRule && keyword.trim().length >= 2) {
      const n = await addRule(keyword, categoryId);
      return props.onDone(`Rule "${keyword.trim().toUpperCase()}" dibuat · ${n} transaksi lain ikut sekali ✨`);
    }
    props.onDone();
  };

  return (
    <Sheet title={t.merchant || 'Transaksi'} onClose={props.onClose}>
      <div class="form">
        <div class="row between">
          <span class="muted">
            {t.date} · {acc?.name}
          </span>
          <Money sen={t.amountSen} />
        </div>
        <p class="desc">{t.description}</p>
        {t.balanceSen !== null && <p class="muted small">Baki lepas ni: {rm(t.balanceSen)}</p>}
        <p class="small">
          Sekarang: <b>{catLabel(d.catMap.get(t.categoryId))}</b> {t.catSource && <span class="muted">({SOURCE[t.catSource]})</span>}
        </p>
        {sug && (
          <button class="btn ghost block" onClick={() => pick(sug.categoryId)}>
            💡 Cadangan: {catLabel(d.catMap.get(sug.categoryId))} ({sug.count} similar)
          </button>
        )}
        <label class="check">
          <input type="checkbox" checked={makeRule} onChange={(e) => setMakeRule((e.target as HTMLInputElement).checked)} />
          <span>
            Jadikan rule: semua transaksi ada keyword ni ikut kategori sama{similar > 0 && ` (${similar} lagi skrg)`}
          </span>
        </label>
        {makeRule && <input value={keyword} onInput={(e) => setKeyword((e.target as HTMLInputElement).value)} aria-label="Keyword" />}
        <label class="field">
          <span>Nota</span>
          <input value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} placeholder="optional" />
        </label>
        <p class="muted small">Pilih kategori:</p>
        <CategoryPicker cats={d.cats} value={t.categoryId} onPick={pick} />
        {t.catSource === 'manual' && (
          <button class="btn ghost block" onClick={() => pick('')}>
            ↩️ Balik auto (ikut rule)
          </button>
        )}
        {note !== t.note && (
          <button class="btn primary block" onClick={async () => (await updateTxn(t.id, { note: note.trim() }), props.onDone())}>
            Save nota
          </button>
        )}
      </div>
    </Sheet>
  );
}
