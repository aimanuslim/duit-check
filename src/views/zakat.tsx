import { useState } from 'preact/hooks';
import { getMeta, setMeta } from '../db';
import { parseInput, rm } from '../money';
import { DEFAULT_ZAKAT, byCategory, inPeriod, totals, zakatFor, type ZakatSettings } from '../report';
import { Empty, Header, PeriodPicker, catLabel, monthName, useAsync, useData, usePref, yearsOf } from '../ui';

export function Zakat() {
  const [d] = useData();
  const [saved, reloadSettings] = useAsync(async () => (await getMeta<ZakatSettings>('zakat')) ?? DEFAULT_ZAKAT);
  const [year, setYear] = usePref('year', String(new Date().getFullYear()));
  const [month, setMonth] = usePref('zmonth', '');
  if (!d || !saved) return null;
  const years = yearsOf(d.txns);
  const y = years.includes(year) ? year : years[0];
  const nisab = saved.nisab[y] ?? null;

  const save = async (s: ZakatSettings) => {
    await setMeta('zakat', s);
    reloadSettings();
  };

  const rows = d.txns.filter((t) => inPeriod(t, y, month));
  const tot = totals(rows, d.catMap);
  const yearTot = month ? totals(d.txns.filter((t) => inPeriod(t, y)), d.catMap) : tot;
  // Nisab is yearly; a month is just that month's share of the yearly zakat.
  const wajibYear = zakatFor(yearTot, saved.method, nisab).wajib;
  const r = zakatFor(tot, saved.method, null);
  const zakat = wajibYear === false ? 0 : r.zakat;
  const keperluan = byCategory(rows, d.catMap).filter((c) => c.category?.bucket === 'keperluan');
  const months = [...new Set(d.txns.filter((t) => inPeriod(t, y)).map((t) => t.date.slice(5, 7)))].sort();

  if (!d.txns.length)
    return (
      <main>
        <Header title="Zakat 🌙" />
        <Empty>Import statement dulu.</Empty>
      </main>
    );

  return (
    <main>
      <Header title="Zakat pendapatan 🌙" />
      <PeriodPicker years={years} year={y} month={month} onChange={(a, b) => (setYear(a), setMonth(b))} />
      <div class="seg" role="radiogroup" aria-label="Kaedah">
        {(['tolakan', 'tanpa'] as const).map((m) => (
          <button key={m} role="radio" aria-checked={saved.method === m} class={saved.method === m ? 'on' : ''} onClick={() => save({ ...saved, method: m })}>
            {m === 'tolakan' ? 'Dengan tolakan' : 'Tanpa tolakan'}
          </button>
        ))}
      </div>

      <div class="card zakat">
        <div class="row between">
          <span>Pendapatan</span>
          <b>{rm(r.pendapatan)}</b>
        </div>
        {saved.method === 'tolakan' && (
          <div class="row between">
            <span>− Keperluan</span>
            <b>{rm(r.keperluan)}</b>
          </div>
        )}
        <div class="row between">
          <span>= Lebihan dikira</span>
          <b>{rm(r.base)}</b>
        </div>
        <hr />
        <div class="row between big">
          <span>Zakat 2.5%</span>
          <b>{rm(zakat)}</b>
        </div>
        {wajibYear === false && <p class="small muted">Lebihan setahun bawah nisab, so x wajib tahun ni.</p>}
        {nisab === null && <p class="small warn">Nisab {y} belum set, so aku kira je tanpa check nisab.</p>}
        {tot.belumCount > 0 && (
          <p class="small warn">
            ⚠️ {tot.belumCount} transaksi belum kategori ({rm(tot.belum)} keluar) x masuk kiraan. <a href={`#/txns?y=${y}${month ? `&m=${month}` : ''}&cat=none`}>Sort dulu</a>
          </p>
        )}
      </div>

      <NisabInput
        key={`${y}:${nisab}`}
        year={y}
        nisab={nisab}
        onSave={(v) => {
          const n = { ...saved.nisab };
          if (v === null) delete n[y];
          else n[y] = v;
          void save({ ...saved, nisab: n });
        }}
      />

      {!month && months.length > 0 && (
        <>
          <h2 class="section">Ikut bulan</h2>
          <table class="tbl">
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Masuk</th>
                <th>Perlu</th>
                <th>2.5%</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const z = zakatFor(totals(d.txns.filter((t) => inPeriod(t, y, m)), d.catMap), saved.method, null);
                return (
                  <tr key={m} class="tap" onClick={() => setMonth(m)}>
                    <td>{monthName(m)}</td>
                    <td>{rm(z.pendapatan)}</td>
                    <td>{rm(z.keperluan)}</td>
                    <td>{rm(wajibYear === false ? 0 : z.zakat)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <h2 class="section">Apa yg dikira keperluan</h2>
      <p class="muted small">
        Keperluan = semua kategori dalam bucket "Keperluan". Nak tukar mana satu kira? Edit bucket kategori kat <a href="#/categories">Kategori</a>, atau tukar kategori transaksi tu.
      </p>
      <ul class="list">
        {keperluan.map((c) => (
          <li key={c.category!.id} class="row between">
            <span>{catLabel(c.category)}</span>
            <span class="money">{rm(c.sen)}</span>
          </li>
        ))}
      </ul>
      <p class="muted small">
        Formula: dengan tolakan = 2.5% × (pendapatan − keperluan); tanpa tolakan = 2.5% × pendapatan. Kehendak/leisure x ditolak. Ni anggaran je — confirm kaedah & had tolakan dgn pusat zakat negeri kau.
      </p>
    </main>
  );
}

function NisabInput(props: { year: string; nisab: number | null; onSave: (sen: number | null) => void }) {
  const [text, setText] = useState(props.nisab ? String(props.nisab / 100) : '');
  return (
    <label class="field">
      <span>Nisab {props.year} (RM, setahun — semak LZS / pusat zakat negeri)</span>
      <div class="row gap">
        <input inputMode="decimal" value={text} placeholder="cth 26000" onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button
          class="btn"
          onClick={() => {
            const v = parseInput(text);
            props.onSave(Number.isNaN(v) || v <= 0 ? null : v);
          }}
        >
          Save
        </button>
      </div>
    </label>
  );
}
