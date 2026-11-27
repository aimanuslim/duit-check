import { SCHEMA_VERSION, exportAll, getMeta, importAll, setMeta, BUCKETS, type UserData } from './db';
import { seal, unseal, type Sealed } from './crypto';

export const APP_SLUG = 'duit-check';
export const BACKUP_REMINDER_DAYS = 14;

type Data = UserData & { meta?: Record<string, unknown> };

export interface BackupFile {
  app: typeof APP_SLUG;
  schemaVersion: number;
  exportedAt: string;
  data: Data;
}

/** On disk the data is either plain (`data`) or passphrase-sealed (`sealed`). */
interface RawFile {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data?: unknown;
  sealed?: Sealed;
}

/** Index i turns backup data at schemaVersion i+1 into i+2. Mirrors db.ts migrations. */
const backupMigrations: Array<(data: any) => any> = [];

export class BackupError extends Error {}
export class NeedsPassphrase extends Error {}

export function backupFilename(dated = false, now = new Date()): string {
  if (!dated) return `${APP_SLUG}-backup.json`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${APP_SLUG}-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export async function buildBackupText(pass = '', now = new Date()): Promise<string> {
  const data = await exportAll();
  const head = { app: APP_SLUG, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString() };
  return JSON.stringify(pass ? { ...head, sealed: await seal(JSON.stringify(data), pass) } : { ...head, data });
}

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function check(cond: boolean, what: string): asserts cond {
  if (!cond) throw new BackupError(`Backup rosak: ${what}`);
}

function validate(d: unknown): Data {
  check(isObj(d), 'data takde');
  const lists = ['accounts', 'statements', 'txns', 'categories', 'rules'] as const;
  for (const k of lists) check(Array.isArray(d[k]), `${k} takde`);
  const base = (r: unknown): r is Record<string, any> => isObj(r) && isStr(r.id) && isNum(r.updatedAt);
  d.accounts.forEach((a: unknown, i: number) => check(base(a) && isStr(a.name) && isStr(a.kind), `akaun #${i}`));
  d.statements.forEach((s: unknown, i: number) => check(base(s) && isStr(s.statementDate), `statement #${i}`));
  d.txns.forEach((t: unknown, i: number) => check(base(t) && isStr(t.accountId) && isStr(t.date) && Number.isInteger(t.amountSen) && isStr(t.categoryId) && isStr(t.description), `transaksi #${i}`));
  d.categories.forEach((c: unknown, i: number) => check(base(c) && isStr(c.name) && BUCKETS.includes(c.bucket), `kategori #${i}`));
  d.rules.forEach((r: unknown, i: number) => check(base(r) && isStr(r.keyword) && isStr(r.categoryId), `rule #${i}`));
  return d as Data;
}

/** Parse + (decrypt) + validate + migrate. Throws NeedsPassphrase if sealed and no/incorrect pass. */
export async function parseBackup(text: string, pass = ''): Promise<BackupFile> {
  let raw: RawFile;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('File ni bukan JSON yang betul.');
  }
  check(isObj(raw), 'bukan object');
  if (raw.app !== APP_SLUG) throw new BackupError(`Ni bukan backup Duit Check (app: ${String(raw.app)}).`);
  const v = raw.schemaVersion;
  check(isNum(v) && Number.isInteger(v) && v >= 1, 'schemaVersion');
  if (v > SCHEMA_VERSION) throw new BackupError('Backup ni dari version app yang lagi baru. Update app dulu.');
  let data: unknown = raw.data;
  if (raw.sealed) {
    if (!pass) throw new NeedsPassphrase('Backup ni berkunci. Masukkan passphrase.');
    try {
      data = JSON.parse(await unseal(raw.sealed, pass));
    } catch {
      throw new NeedsPassphrase('Passphrase salah.');
    }
  }
  for (let i = v; i < SCHEMA_VERSION; i++) data = backupMigrations[i - 1](data);
  return { app: APP_SLUG, schemaVersion: SCHEMA_VERSION, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : '', data: validate(data) };
}

export const summarize = (d: Data) => `${d.txns.length} transaksi, ${d.statements.length} statement, ${d.accounts.length} akaun, ${d.categories.length} kategori, ${d.rules.length} rule`;

export const applyImport = (f: BackupFile, mode: 'replace' | 'merge') => importAll(f.data, mode);

export const getLastBackupAt = () => getMeta<number>('lastBackupAt');

export function needsBackupReminder(last: number | undefined, now = Date.now()): boolean {
  return last === undefined || now - last > BACKUP_REMINDER_DAYS * 86_400_000;
}

/** Share sheet on iOS when possible (Save to Files), else a download link. false = cancelled. */
export async function exportToUser(dated = false, pass = ''): Promise<boolean> {
  const name = backupFilename(dated);
  const blob = new Blob([await buildBackupText(pass)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return false;
      download(blob, name);
    }
  } else download(blob, name);
  await setMeta('lastBackupAt', Date.now());
  return true;
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
