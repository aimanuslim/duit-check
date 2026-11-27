import { useState } from 'preact/hooks';
import { addRule } from '../actions';
import { keywordGroups, type KeywordGroup } from '../engine';
import { rm } from '../money';
import { CategoryPicker, Empty, Header, Sheet, Toast, useData } from '../ui';

export function Keywords() {
  const [d, reload] = useData();
  const [onlyNew, setOnlyNew] = useState(true);
  const [open, setOpen] = useState<KeywordGroup | null>(null);
  const [kw, setKw] = useState('');
  const [toast, setToast] = useState('');
  if (!d) return null;
  const groups = keywordGroups(d.txns.filter((t) => t.catSource !== 'transfer' && (!onlyNew || !t.categoryId)));

  return (
    <main>
      <Header title="Cari keyword 🔎" back="/more" />
      <p class="muted small">Merchant dari statement kau, susun ikut jumlah duit. Tap satu → pilih kategori → jadi rule, semua yg sama terus ikut.</p>
      <label class="check">
        <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew((e.target as HTMLInputElement).checked)} />
        <span>Belum kategori je</span>
      </label>
      {!groups.length && <Empty>{onlyNew ? 'Semua dah ada kategori 🎉' : 'Takde data.'}</Empty>}
      <ul class="list">
        {groups.slice(0, 300).map((g) => (
          <li
            key={g.keyword}
            class="tap row between"
            onClick={() => {
              setOpen(g);
              setKw(g.keyword);
            }}
          >
            <span class="ellipsis">
              <b>{g.keyword}</b>
              <br />
              <small class="muted">{g.count}×</small>
            </span>
            <span class="money">{rm(g.totalSen)}</span>
          </li>
        ))}
      </ul>
      {open && (
        <Sheet title="Jadikan rule" onClose={() => setOpen(null)}>
          <div class="form">
            <p class="muted small">Contoh: {open.sample}</p>
            <label class="field">
              <span>Keyword (boleh pendekkan, cth "FOODPANDA")</span>
              <input value={kw} onInput={(e) => setKw((e.target as HTMLInputElement).value)} />
            </label>
            <CategoryPicker
              cats={d.cats}
              value=""
              onPick={async (cat) => {
                if (kw.trim().length < 2) return;
                const n = await addRule(kw, cat);
                setOpen(null);
                reload();
                setToast(`Rule "${kw.trim().toUpperCase()}" · ${n} transaksi masuk kategori ✨`);
              }}
            />
          </div>
        </Sheet>
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </main>
  );
}
