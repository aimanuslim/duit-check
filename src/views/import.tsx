import { useState } from 'preact/hooks';
import { importStatement, isDuplicate } from '../actions';
import { deleteStatement, listStatements } from '../db';
import { rm } from '../money';
import { parseLines } from '../parse';
import { PasswordNeeded, pdfToLines } from '../parse/pdf';
import type { ParsedStatement } from '../parse/types';
import { Header, Toast, useAsync } from '../ui';

interface Item {
  name: string;
  buf: ArrayBuffer;
  parsed?: ParsedStatement;
  dup?: boolean;
  error?: string;
  needsPass?: boolean;
  done?: string;
}

async function load(name: string, buf: ArrayBuffer, password?: string): Promise<Item> {
  try {
    const parsed = parseLines(await pdfToLines(buf.slice(0), password));
    return { name, buf, parsed, dup: await isDuplicate(parsed) };
  } catch (e) {
    return { name, buf, error: (e as Error).message, needsPass: e instanceof PasswordNeeded };
  }
}

export function Import() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [stmts, reload] = useAsync(listStatements);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const out: Item[] = [];
    for (const f of [...files]) out.push(await load(f.name, await f.arrayBuffer()));
    // Same statement picked twice in one go (e.g. re-downloaded copy)
    const seen = new Set<string>();
    for (const it of out) {
      const k = it.parsed && `${it.parsed.parserId}|${it.parsed.statementDate}|${it.parsed.accounts.map((a) => a.key).join()}`;
      if (k && seen.has(k)) it.dup = true;
      if (k) seen.add(k);
    }
    setItems(out);
    setBusy(false);
  };

  const update = (i: number, it: Item) => setItems((xs) => xs.map((x, j) => (j === i ? it : x)));

  const doImport = async (i: number) => {
    const it = items[i];
    if (!it.parsed) return;
    try {
      const r = await importStatement(it.parsed);
      update(i, { ...it, done: `✅ ${r.count} transaksi masuk, ${r.categorised} dah auto-kategori` });
      reload();
    } catch (e) {
      update(i, { ...it, error: (e as Error).message });
    }
  };

  return (
    <main>
      <Header title="Import statement ⬆️" />
      <label class="drop">
        <input type="file" accept="application/pdf,.pdf" multiple onChange={(e) => pick((e.target as HTMLInputElement).files)} />
        <span>{busy ? 'Tengah baca PDF…' : '📄 Pilih PDF statement (boleh banyak sekali)'}</span>
        <small class="muted">Maybank simpanan/semasa, Maybank kad kredit, AmBank kad kredit. Semua proses dalam phone ni, x upload mana2.</small>
      </label>

      {items.map((it, i) => (
        <div class="card" key={i}>
          <p class="muted small ellipsis">{it.name}</p>
          {it.needsPass && <PassRetry error={it.error!} onTry={async (p) => update(i, await load(it.name, it.buf, p))} />}
          {it.error && !it.needsPass && <p class="warn">⚠️ {it.error}</p>}
          {it.parsed && (
            <>
              <h3>{it.parsed.label}</h3>
              <p class="small">
                Tarikh penyata {it.parsed.statementDate} · {it.parsed.txns.length} transaksi
              </p>
              <ul class="checks">
                {it.parsed.checks.map((c) => (
                  <li key={c.accountKey}>
                    {c.ok ? '✅' : '❌'} ·{c.accountKey.slice(-4)} baki {rm(c.openingSen)} → {rm(c.closingSen)}
                    {!c.ok && <span class="warn"> (kira: {rm(c.computedSen)}, beza {rm(c.computedSen - c.closingSen)})</span>}
                  </li>
                ))}
              </ul>
              {it.done ? (
                <p>{it.done}</p>
              ) : it.dup ? (
                <p class="warn">Statement ni dah ada. Skip.</p>
              ) : (
                <button class="btn primary block" onClick={() => doImport(i)}>
                  {it.parsed.checks.every((c) => c.ok) ? 'Import' : 'Baki x match — import juga?'}
                </button>
              )}
            </>
          )}
        </div>
      ))}

      <h2 class="section">Dah import</h2>
      <ul class="list">
        {stmts?.map((s) => (
          <li key={s.id} class="row between">
            <span>
              {s.reconciled ? '✅' : '❌'} {s.label}
              <br />
              <small class="muted">
                {s.statementDate} · {s.txnCount} transaksi
              </small>
            </span>
            <button
              class="icon-btn"
              aria-label="Delete statement"
              onClick={async () => {
                if (!confirm(`Delete statement ${s.label} (${s.statementDate}) dan semua transaksi dia?`)) return;
                await deleteStatement(s.id);
                reload();
                setToast('Statement dibuang');
              }}
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </main>
  );
}

function PassRetry(props: { error: string; onTry: (p: string) => void }) {
  const [p, setP] = useState('');
  return (
    <div class="row gap">
      <input type="password" placeholder={props.error} value={p} onInput={(e) => setP((e.target as HTMLInputElement).value)} />
      <button class="btn" onClick={() => props.onTry(p)}>
        Buka
      </button>
    </div>
  );
}
