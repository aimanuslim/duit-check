import { updateAccount } from '../db';
import { Header, useData } from '../ui';

const KIND = { savings: 'Simpanan', current: 'Semasa', credit_card: 'Kad kredit', investment: 'Pelaburan' } as const;

export function Accounts() {
  const [d, reload] = useData();
  if (!d) return null;
  const cards = d.accounts.filter((a) => a.kind === 'credit_card');
  return (
    <main>
      <Header title="Akaun & kad 🏦" back="/more" />
      {!d.accounts.length && <p class="muted">Akaun muncul auto lepas import statement.</p>}
      <ul class="list">
        {d.accounts.map((a) => (
          <li key={a.id} class="form">
            <small class="muted">
              {a.bank.toUpperCase()} · {KIND[a.kind]} · ·{a.last4} · {d.txns.filter((t) => t.accountId === a.id).length} transaksi
            </small>
            <input
              value={a.name}
              aria-label="Nama akaun"
              onChange={async (e) => {
                const name = (e.target as HTMLInputElement).value.trim();
                if (name) await updateAccount(a.id, { name });
                reload();
              }}
            />
            {a.kind === 'credit_card' && (
              <label class="field">
                <span>Kad supplementary bawah</span>
                <select
                  value={a.parentId ?? ''}
                  onChange={async (e) => {
                    await updateAccount(a.id, { parentId: (e.target as HTMLSelectElement).value || null });
                    reload();
                  }}
                >
                  <option value="">— (kad utama)</option>
                  {cards
                    .filter((c) => c.id !== a.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
