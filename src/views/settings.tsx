import { useState } from 'preact/hooks';
import { BackupError, NeedsPassphrase, applyImport, exportToUser, getLastBackupAt, parseBackup, summarize, type BackupFile } from '../backup';
import { deleteAll, getMeta, seedIfEmpty } from '../db';
import { Header, Sheet, Toast, useAsync } from '../ui';

export function Settings() {
  const [info, reload] = useAsync(async () => ({ last: await getLastBackupAt(), persist: await getMeta<boolean>('persistRequested') }));
  const [pass, setPass] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState<{ text: string; file?: BackupFile; needPass?: string } | null>(null);
  const [wipe, setWipe] = useState(false);

  const doExport = async (dated: boolean) => {
    if ((await exportToUser(dated, pass)) !== false) {
      setToast(pass ? 'Backup berkunci dah export 🔐' : 'Backup dah export');
      reload();
    }
  };

  const readFile = async (f: File | undefined, p = '') => {
    if (!f) return;
    const text = await f.text();
    await tryParse(text, p);
  };
  const tryParse = async (text: string, p: string) => {
    try {
      setPending({ text, file: await parseBackup(text, p) });
    } catch (e) {
      if (e instanceof NeedsPassphrase) setPending({ text, needPass: e.message });
      else setToast(e instanceof BackupError ? e.message : 'Tak dapat baca file tu');
    }
  };

  return (
    <main>
      <Header title="Backup & settings" back="/more" />
      <section class="card form">
        <h3>💾 Backup</h3>
        <p class="muted small">
          Data duduk dalam phone ni je. Last backup: {info?.last ? new Date(info.last).toLocaleString('ms-MY') : 'belum pernah'}.
        </p>
        <label class="field">
          <span>Passphrase (optional, encrypt backup — jangan lupa!)</span>
          <input type="password" value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} autocomplete="new-password" />
        </label>
        <button class="btn primary block" onClick={() => doExport(false)}>
          Export backup
        </button>
        <button class="btn ghost block" onClick={() => doExport(true)}>
          Export copy bertarikh
        </button>
        <label class="btn ghost block file-btn">
          Import backup…
          <input type="file" accept="application/json,.json" onChange={(e) => readFile((e.target as HTMLInputElement).files?.[0])} />
        </label>
      </section>

      <section class="card">
        <h3>📦 Storage</h3>
        <p class="small">{info?.persist ? 'Persistent ✅ (browser x buang auto)' : 'Best-effort ⚠️ — browser boleh buang kalau storage penuh. Selalu backup.'}</p>
      </section>

      <section class="card form">
        <h3>🧨 Padam semua data</h3>
        <button class="btn danger-ghost block" onClick={() => setWipe(true)}>
          Padam semua…
        </button>
      </section>

      {pending && (
        <Sheet title="Import backup" onClose={() => setPending(null)}>
          {pending.needPass ? (
            <PassForm msg={pending.needPass} onSubmit={(p) => tryParse(pending.text, p)} />
          ) : (
            pending.file && (
              <div class="form">
                <p>{summarize(pending.file.data)}</p>
                <p class="muted small">Export: {pending.file.exportedAt}</p>
                <button
                  class="btn primary block"
                  onClick={async () => {
                    if (!confirm('Replace: semua data sekarang diganti dgn backup ni. Confirm?')) return;
                    await applyImport(pending.file!, 'replace');
                    setPending(null);
                    setToast('Data diganti dari backup ✅');
                  }}
                >
                  Replace semua
                </button>
                <button
                  class="btn ghost block"
                  onClick={async () => {
                    if (!confirm('Merge: gabung ikut id, yg lagi baru menang. Confirm?')) return;
                    await applyImport(pending.file!, 'merge');
                    setPending(null);
                    setToast('Backup digabung ✅');
                  }}
                >
                  Merge
                </button>
              </div>
            )
          )}
        </Sheet>
      )}
      {wipe && <WipeSheet onClose={() => setWipe(false)} onDone={() => (setWipe(false), setToast('Semua data dah padam'))} />}
      {toast && <Toast text={toast} onDone={() => setToast('')} />}
    </main>
  );
}

function PassForm(props: { msg: string; onSubmit: (p: string) => void }) {
  const [p, setP] = useState('');
  return (
    <div class="form">
      <p>{props.msg}</p>
      <input type="password" value={p} onInput={(e) => setP((e.target as HTMLInputElement).value)} />
      <button class="btn primary block" onClick={() => props.onSubmit(p)}>
        Buka
      </button>
    </div>
  );
}

function WipeSheet(props: { onClose: () => void; onDone: () => void }) {
  const [t, setT] = useState('');
  return (
    <Sheet title="Padam semua data" onClose={props.onClose}>
      <div class="form">
        <p>Semua statement, transaksi, kategori & rule hilang. Export backup dulu kalau nak simpan. Taip <b>PADAM</b> utk confirm.</p>
        <input value={t} onInput={(e) => setT((e.target as HTMLInputElement).value)} aria-label="Taip PADAM" />
        <button
          class="btn danger block"
          disabled={t !== 'PADAM'}
          onClick={async () => {
            await deleteAll();
            await seedIfEmpty();
            props.onDone();
          }}
        >
          Padam
        </button>
      </div>
    </Sheet>
  );
}
