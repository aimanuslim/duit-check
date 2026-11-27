import { useState } from 'preact/hooks';
import { addRule, applyRules } from '../actions';
import { BUCKETS, BUCKET_LABEL, TRANSFER_CATEGORY_ID, deleteCategory, deleteRule, saveCategory, type Bucket, type Category } from '../db';
import { Header, Sheet, Toast, catLabel, useData } from '../ui';

export function Categories() {
  const [d, reload] = useData();
  const [edit, setEdit] = useState<Category | 'new' | null>(null);
  const [kw, setKw] = useState('');
  const [kwCat, setKwCat] = useState('');
  const [toast, setToast] = useState('');
  if (!d) return null;
  const count = (id: string) => d.txns.filter((t) => t.categoryId === id).length;

  return (
    <main>
      <Header
        title="Kategori & rule"
        back="/more"
        action={
          <button class="btn small primary" onClick={() => setEdit('new')}>
            + Kategori
          </button>
        }
      />
      {BUCKETS.map((b) => (
        <section key={b}>
          <h2 class={`section bucket-title b-${b}`}>{BUCKET_LABEL[b]}</h2>
          <ul class="list">
            {d.cats
              .filter((c) => c.bucket === b)
              .map((c) => (
                <li key={c.id} class="tap row between" onClick={() => setEdit(c)}>
                  <span>{catLabel(c)}</span>
                  <small class="muted">{count(c.id)} txn · {d.rules.filter((r) => r.categoryId === c.id).length} rule</small>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <h2 class="section">Rule keyword</h2>
      <p class="muted small">Kalau description transaksi ada keyword ni, dia auto masuk kategori tu. Keyword paling panjang menang. Yg kau set sendiri x kena overwrite.</p>
      <div class="row gap wrap">
        <input placeholder="cth FOODPANDA" value={kw} onInput={(e) => setKw((e.target as HTMLInputElement).value)} />
        <select value={kwCat} onChange={(e) => setKwCat((e.target as HTMLSelectElement).value)} aria-label="Kategori">
          <option value="">Pilih kategori</option>
          {d.cats.map((c) => (
            <option key={c.id} value={c.id}>
              {catLabel(c)}
            </option>
          ))}
        </select>
        <button
          class="btn primary"
          disabled={kw.trim().length < 2 || !kwCat}
          onClick={async () => {
            const n = await addRule(kw, kwCat);
            setKw('');
            reload();
            setToast(`Rule ditambah · ${n} transaksi berubah`);
          }}
        >
          Tambah
        </button>
      </div>
      <ul class="list">
        {d.rules.map((r) => (
          <li key={r.id} class="row between">
            <span>
              <code>{r.keyword}</code> → {catLabel(d.catMap.get(r.categoryId))}
            </span>
            <button
              class="icon-btn"
              aria-label={`Buang rule ${r.keyword}`}
              onClick={async () => {
                await deleteRule(r.id);
                const n = await applyRules();
                reload();
                setToast(`Rule dibuang · ${n} transaksi berubah`);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        class="btn ghost block"
        onClick={async () => {
          const n = await applyRules();
          reload();
          setToast(`${n} transaksi dikemaskini`);
        }}
      >
        🔄 Apply semula semua rule
      </button>

      {edit && (
        <CatSheet
          cat={edit === 'new' ? null : edit}
          used={edit === 'new' ? 0 : count(edit.id)}
          onClose={() => setEdit(null)}
          onDone={() => {
            setEdit(null);
            reload();
          }}
        />
      )}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </main>
  );
}

function CatSheet(props: { cat: Category | null; used: number; onClose: () => void; onDone: () => void }) {
  const c = props.cat;
  const [name, setName] = useState(c?.name ?? '');
  const [emoji, setEmoji] = useState(c?.emoji ?? '🏷️');
  const [bucket, setBucket] = useState<Bucket>(c?.bucket ?? 'keperluan');
  const system = c?.id === TRANSFER_CATEGORY_ID;
  return (
    <Sheet title={c ? 'Edit kategori' : 'Kategori baru'} onClose={props.onClose}>
      <div class="form">
        <div class="row gap">
          <input class="emoji" value={emoji} onInput={(e) => setEmoji((e.target as HTMLInputElement).value)} aria-label="Emoji" />
          <input value={name} placeholder="Nama (cth Makanan)" onInput={(e) => setName((e.target as HTMLInputElement).value)} aria-label="Nama" />
        </div>
        <label class="field">
          <span>Kira sebagai</span>
          <select value={bucket} disabled={system} onChange={(e) => setBucket((e.target as HTMLSelectElement).value as Bucket)}>
            {BUCKETS.map((b) => (
              <option key={b} value={b}>
                {BUCKET_LABEL[b]}
              </option>
            ))}
          </select>
        </label>
        <p class="muted small">Keperluan je yg ditolak dari pendapatan masa kira zakat (dengan tolakan).</p>
        <button
          class="btn primary block"
          disabled={!name.trim()}
          onClick={async () => {
            await saveCategory({ id: c?.id, name, emoji, bucket });
            props.onDone();
          }}
        >
          Save
        </button>
        {c && !system && (
          <button
            class="btn danger-ghost block"
            onClick={async () => {
              if (!confirm(`Delete "${c.name}"? ${props.used} transaksi jadi belum kategori, rule dia pun hilang.`)) return;
              await deleteCategory(c.id);
              props.onDone();
            }}
          >
            Delete kategori
          </button>
        )}
      </div>
    </Sheet>
  );
}
