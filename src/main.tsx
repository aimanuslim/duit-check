import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { getLastBackupAt, needsBackupReminder } from './backup';
import { getMeta, seedIfEmpty, setMeta } from './db';
import { useRoute } from './ui';
import { Accounts } from './views/accounts';
import { Categories } from './views/categories';
import { Import } from './views/import';
import { Keywords } from './views/keywords';
import { More } from './views/more';
import { Overview } from './views/overview';
import { Settings } from './views/settings';
import { Txns } from './views/txns';
import { Zakat } from './views/zakat';
import './style.css';

let applyUpdate: (() => void) | null = null;
let notifyUpdate: (() => void) | null = null;

function View({ path, query }: { path: string; query: string }) {
  switch (path) {
    case '/txns':
      return <Txns query={query} key={query} />;
    case '/import':
      return <Import />;
    case '/zakat':
      return <Zakat />;
    case '/more':
      return <More />;
    case '/categories':
      return <Categories />;
    case '/keywords':
      return <Keywords />;
    case '/accounts':
      return <Accounts />;
    case '/settings':
      return <Settings />;
    default:
      return <Overview />;
  }
}

const TABS = [
  { path: '/', label: 'Overview', icon: '📊', match: ['/'] },
  { path: '/txns', label: 'Transaksi', icon: '📜', match: ['/txns'] },
  { path: '/import', label: 'Import', icon: '⬆️', match: ['/import'] },
  { path: '/zakat', label: 'Zakat', icon: '🌙', match: ['/zakat'] },
  { path: '/more', label: 'Lagi', icon: '☰', match: ['/more', '/categories', '/keywords', '/accounts', '/settings'] },
];

function App() {
  const route = useRoute();
  const [path, query = ''] = route.split('?');
  const [update, setUpdate] = useState(() => !!applyUpdate);
  const [remind, setRemind] = useState(false);

  useEffect(() => {
    notifyUpdate = () => setUpdate(true);
    getLastBackupAt().then((t) => setRemind(needsBackupReminder(t)));
  }, []);
  useEffect(() => window.scrollTo(0, 0), [path]);

  return (
    <div class="app">
      {/* Never reload mid-import; the banner waits for another screen. */}
      {update && path !== '/import' && (
        <div class="banner">
          Ada update baru.
          <button class="btn small primary" onClick={() => applyUpdate?.()}>
            Reload
          </button>
        </div>
      )}
      {remind && path === '/' && (
        <div class="banner soft">
          <span>Backup la data kau — dia duduk dalam phone ni je.</span>
          <a class="btn small ghost" href="#/settings" onClick={() => setRemind(false)}>
            Backup
          </a>
          <button class="icon-btn" aria-label="Tutup" onClick={() => setRemind(false)}>
            ×
          </button>
        </div>
      )}
      <View path={path} query={query} />
      <nav class="tabs">
        {TABS.map((tab) => (
          <a key={tab.path} href={`#${tab.path}`} class={tab.match.includes(path) ? 'on' : ''}>
            <span aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

async function boot() {
  await seedIfEmpty();
  render(<App />, document.getElementById('app')!);
  if ((await getMeta('persistRequested')) === undefined) await setMeta('persistRequested', (await navigator.storage?.persist?.()) ?? false);
}

const updateSW = registerSW({
  onNeedRefresh() {
    applyUpdate = () => updateSW(true);
    notifyUpdate?.();
  },
});

void boot();
