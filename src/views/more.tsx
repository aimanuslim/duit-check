import { Header } from '../ui';

const LINKS = [
  ['#/categories', '🏷️', 'Kategori & rule', 'Buat kategori sendiri, set mana satu keperluan'],
  ['#/keywords', '🔎', 'Cari keyword', 'Pilih merchant dari data kau, terus jadikan rule'],
  ['#/accounts', '🏦', 'Akaun & kad', 'Rename, link kad supplementary'],
  ['#/settings', '💾', 'Backup & settings', 'Export/import, padam data'],
];

export const More = () => (
  <main>
    <Header title="Lagi" />
    <ul class="list">
      {LINKS.map(([href, icon, title, sub]) => (
        <li key={href}>
          <a class="row gap link-row" href={href}>
            <span class="big-icon">{icon}</span>
            <span>
              <b>{title}</b>
              <br />
              <small class="muted">{sub}</small>
            </span>
          </a>
        </li>
      ))}
    </ul>
  </main>
);
