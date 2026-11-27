import { BUCKET_LABEL } from '../db';
import { rm } from '../money';
import { byCategory, inPeriod, totals } from '../report';
import { Empty, Header, Money, PeriodPicker, catLabel, monthName, nav, useData, usePref, yearsOf } from '../ui';

export function Overview() {
  const [d] = useData();
  const [year, setYear] = usePref('year', String(new Date().getFullYear()));
  const [month, setMonth] = usePref('month', '');
  const [acc, setAcc] = usePref('acc', '');
  if (!d) return null;
  if (!d.txns.length)
    return (
      <main>
        <Header title="Duit Check 💸" />
        <Empty>
          <p>Takde data lagi. Import statement PDF dulu (Maybank / AmBank).</p>
          <a class="btn primary" href="#/import">
            ⬆️ Import statement
          </a>
        </Empty>
      </main>
    );

  const years = yearsOf(d.txns);
  const y = years.includes(year) ? year : years[0];
  // A principal card filter includes its supplementary cards.
  const inAcc = (id: string) => !acc || id === acc || d.accMap.get(id)?.parentId === acc;
  const rows = d.txns.filter((t) => inPeriod(t, y, month) && inAcc(t.accountId));
  const tot = totals(rows, d.catMap);
  const spent = tot.keperluan + tot.kehendak;
  const baki = tot.pendapatan - spent - tot.simpanan;
  const cats = byCategory(rows, d.catMap);
  const max = Math.max(1, ...cats.map((c) => c.sen));
  const months = month ? [] : [...new Set(rows.map((t) => t.date.slice(5, 7)))].sort();

  const goTxns = (q: string) => nav(`/txns?y=${y}${month ? `&m=${month}` : ''}${acc ? `&acc=${encodeURIComponent(acc)}` : ''}&${q}`);

  return (
    <main>
      <Header title="Duit lari mana 💸" />
      <PeriodPicker years={years} year={y} month={month} onChange={(a, b) => (setYear(a), setMonth(b))} />
      <select class="block-select" value={acc} onChange={(e) => setAcc((e.target as HTMLSelectElement).value)} aria-label="Akaun">
        <option value="">Semua akaun</option>
        {d.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      {tot.belumCount > 0 && (
        <button class="banner soft block" onClick={() => goTxns('cat=none')}>
          ❓ {tot.belumCount} transaksi belum kategori ({rm(-tot.belum)}). Tap utk sort.
        </button>
      )}

      <div class="tiles">
        <Tile label="Masuk" sen={tot.pendapatan} cls="b-pendapatan" />
        <Tile label={BUCKET_LABEL.keperluan} sen={tot.keperluan} cls="b-keperluan" />
        <Tile label="Kehendak / leisure" sen={tot.kehendak} cls="b-kehendak" />
        <Tile label="Simpan & labur" sen={tot.simpanan} cls="b-simpanan" />
        <Tile label="Baki (masuk − semua)" sen={baki} cls={baki < 0 ? 'neg' : ''} wide />
      </div>

      {spent > 0 && (
        <div class="stack" aria-label="Keperluan vs kehendak">
          <span class="b-keperluan" style={{ flex: tot.keperluan }} />
          <span class="b-kehendak" style={{ flex: tot.kehendak }} />
          <span class="b-simpanan" style={{ flex: Math.max(0, tot.simpanan) }} />
        </div>
      )}

      <h2 class="section">Ikut kategori</h2>
      <ul class="list">
        {cats.map((c) => (
          <li key={c.category?.id ?? 'none'} class="tap" onClick={() => goTxns(`cat=${c.category?.id ?? 'none'}`)}>
            <div class="row between">
              <span>{catLabel(c.category)}</span>
              <span class="money">{rm(c.sen)}</span>
            </div>
            <div class="bar">
              <span class={`b-${c.category?.bucket ?? 'none'}`} style={{ width: `${(Math.max(0, c.sen) / max) * 100}%` }} />
            </div>
            <small class="muted">{c.count} transaksi</small>
          </li>
        ))}
      </ul>

      {months.length > 1 && (
        <>
          <h2 class="section">Bulan ke bulan</h2>
          <table class="tbl">
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Perlu</th>
                <th>Kehendak</th>
                <th>Simpan</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const t = totals(rows.filter((r) => r.date.slice(5, 7) === m), d.catMap);
                return (
                  <tr key={m} class="tap" onClick={() => setMonth(m)}>
                    <td>{monthName(m)}</td>
                    <td>{rm(t.keperluan)}</td>
                    <td>{rm(t.kehendak)}</td>
                    <td>{rm(t.simpanan)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}

const Tile = (p: { label: string; sen: number; cls: string; wide?: boolean }) => (
  <div class={`tile ${p.wide ? 'wide' : ''}`}>
    <small class={`dot ${p.cls}`}>{p.label}</small>
    <strong>
      <Money sen={p.sen} plain />
    </strong>
  </div>
);
