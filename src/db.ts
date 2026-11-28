// The only module that touches IndexedDB. UI code goes through this typed API.
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction, type StoreNames } from 'idb';
import type { AccountKind, Bank, ParsedStatement } from './parse/types';

export const DB_NAME = 'duit-check';
export const SCHEMA_VERSION = 2;

/** How a category counts. Zakat (dengan tolakan) = pendapatan - keperluan. */
export type Bucket = 'keperluan' | 'kehendak' | 'simpanan' | 'pendapatan' | 'pindahan';
export const BUCKETS: Bucket[] = ['keperluan', 'kehendak', 'simpanan', 'pendapatan', 'pindahan'];
export const BUCKET_LABEL: Record<Bucket, string> = {
  keperluan: 'Keperluan',
  kehendak: 'Kehendak / leisure',
  simpanan: 'Simpanan & pelaburan',
  pendapatan: 'Pendapatan',
  pindahan: 'Pindahan sendiri (x kira)',
};

export interface Account {
  id: string; // bank:kind:last4, same across statements
  bank: Bank;
  kind: AccountKind;
  name: string;
  product: string;
  last4: string;
  holderRole: 'P' | 'S';
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Statement {
  id: string; // statementKey()
  parserId: string;
  label: string;
  statementDate: string;
  accountIds: string[];
  txnCount: number;
  reconciled: boolean;
  importedAt: number;
  createdAt: number;
  updatedAt: number;
}

/** manual beats transfer beats rule; '' = belum kategori */
export type CatSource = 'manual' | 'transfer' | 'rule' | '';

export interface Txn {
  id: string;
  statementId: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  description: string;
  merchant: string;
  amountSen: number; // negative = keluar
  balanceSen: number | null;
  categoryId: string;
  catSource: CatSource;
  transferPairId: string | null;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  bucket: Bucket;
  /** Deducted from pendapatan when kira zakat dengan tolakan. Default: bucket === 'keperluan'. */
  zakatDeduct: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Case-insensitive "contains" on description + merchant. Longest keyword wins. */
export interface Rule {
  id: string;
  keyword: string;
  categoryId: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserData {
  accounts: Account[];
  statements: Statement[];
  txns: Txn[];
  categories: Category[];
  rules: Rule[];
}

interface Schema extends DBSchema {
  accounts: { key: string; value: Account };
  statements: { key: string; value: Statement };
  txns: { key: string; value: Txn; indexes: { byStatement: string } };
  categories: { key: string; value: Category };
  rules: { key: string; value: Rule };
  meta: { key: string; value: { key: string; value: unknown } };
}

type UpgradeTx = IDBPTransaction<Schema, StoreNames<Schema>[], 'versionchange'>;

/** Buckets whose categories may be marked as a zakat deduction (not income, not transfers). */
export const canDeduct = (b: Bucket) => b !== 'pendapatan' && b !== 'pindahan';

/** Index i upgrades the DB from version i to i+1. Append only; never edit a shipped entry. */
const migrations: Array<(db: IDBPDatabase<Schema>, tx: UpgradeTx) => void | Promise<void>> = [
  (db) => {
    db.createObjectStore('accounts', { keyPath: 'id' });
    db.createObjectStore('statements', { keyPath: 'id' });
    db.createObjectStore('txns', { keyPath: 'id' }).createIndex('byStatement', 'statementId');
    db.createObjectStore('categories', { keyPath: 'id' });
    db.createObjectStore('rules', { keyPath: 'id' });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
  // v1 -> v2: per-category zakat deduction flag (keperluan stays deducted as before)
  async (_db, tx) => {
    const store = tx.objectStore('categories');
    for (const c of await store.getAll()) await store.put({ ...c, zakatDeduct: c.bucket === 'keperluan' });
  },
];

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, SCHEMA_VERSION, {
    async upgrade(database, oldVersion, _newVersion, tx) {
      for (let v = oldVersion; v < SCHEMA_VERSION; v++) await migrations[v](database, tx);
    },
    blocking() {
      dbPromise?.then((d) => d.close());
      dbPromise = null;
    },
  });
  return dbPromise;
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);

// ---------- seed ----------

export const TRANSFER_CATEGORY_ID = 'pindahan';

type Seed = [emoji: string, name: string, bucket: Bucket, keywords: string[]];
export const DEFAULT_CATEGORIES: Seed[] = [
  ['🍚', 'Groceries & barang dapur', 'keperluan', ['AEON CO', 'GIANT', 'LOTUS', 'MYDIN', 'JAYA GROCER', '99 SPEED', '7-ELEVEN', 'FAMILYMART', 'ECONSAVE', 'PASAR RAYA', 'MR DIY']],
  ['💡', 'Bil & utiliti', 'keperluan', ['TNB', 'AIR SELAN', 'UNIFI', 'YOODO', 'MAXIS', 'CELCOM', 'DIGI TELECOM', 'U MOBILE', 'INDAH WATER']],
  ['⛽', 'Minyak & transport', 'keperluan', ['PETRONAS', 'SHELL', 'SETEL', 'CALTEX', 'BHPETROL', 'PETRON']],
  ['🛣️', 'Tol & parking', 'keperluan', ['TOLL', 'SPRINT', 'PARKING']],
  ['🏠', 'Rumah', 'keperluan', []],
  ['🩺', 'Kesihatan', 'keperluan', ['PHYSIO', 'KLINIK', 'CLINIC', 'HOSPITAL', 'FARMASI', 'PHARMACY', 'DR ']],
  ['🛡️', 'Takaful & insurans', 'keperluan', ['PRUBSN', 'TAKAFUL', 'ETIQA', 'GREAT EASTERN']],
  ['📚', 'Pendidikan', 'keperluan', ['PTPTN']],
  ['💳', 'Hutang & ansuran', 'keperluan', ['SPAYLATER', 'ATOME', 'AEON CREDIT', 'PAYLATER', 'MAJLIS AMANAH RAKYAT']],
  ['👨‍👩‍👧', 'Keluarga', 'keperluan', []],
  ['☕', 'Makan luar', 'kehendak', ['FOODPANDA', 'GRABFOOD', 'BISTRO', 'RESTORAN', 'WARUNG', 'KOPI', 'MCDONALD', 'KFC', 'STARBUCKS', 'ZUS ']],
  ['🛍️', 'Shopping', 'kehendak', ['SHOPEE', 'LAZADA', 'DECATHLON', 'UNIQLO']],
  ['📺', 'Langganan', 'kehendak', ['APPLE.COM', 'NETFLIX', 'SPOTIFY', 'YOUTUBE', 'CLASSPASS']],
  ['✈️', 'Jalan2 & hiburan', 'kehendak', ['HOTEL', 'AIRASIA', 'AGODA']],
  ['🤲', 'Sedekah & derma', 'kehendak', ['MASJID', 'SURAU', 'HIDAYAH CENTRE', 'PERTUBUHAN', 'YAYASAN']],
  ['💰', 'Simpanan & pelaburan', 'simpanan', ['AMANAH SAHAM', 'MOOMOO', 'WAHED', 'TABUNG HAJI', 'STASHAWAY', 'VERSA']],
  ['💼', 'Gaji', 'pendapatan', ['GIRO CR']],
  ['🎁', 'Cashback & refund', 'pendapatan', ['CASH BACK', 'CASHBACK', 'REFUND']],
  ['➕', 'Pendapatan lain', 'pendapatan', []],
  ['🔁', 'Pindahan sendiri', 'pindahan', ['PYMT@MAYBANK2U', 'PAYMENT VIA RPP RECEIVED', 'AMERICAN EXPRESS IS', 'VISA ISLAMIC']],
];

export async function seedIfEmpty(): Promise<void> {
  if (await getMeta('seeded')) return;
  const d = await db();
  const tx = d.transaction(['categories', 'rules', 'meta'], 'readwrite');
  const now = Date.now();
  DEFAULT_CATEGORIES.forEach(([emoji, name, bucket, kws], order) => {
    const id = bucket === 'pindahan' ? TRANSFER_CATEGORY_ID : uid();
    void tx.objectStore('categories').put({ id, name, emoji, bucket, zakatDeduct: bucket === 'keperluan', order, createdAt: now, updatedAt: now });
    for (const keyword of kws) void tx.objectStore('rules').put({ id: uid(), keyword, categoryId: id, createdAt: now, updatedAt: now });
  });
  void tx.objectStore('meta').put({ key: 'seeded', value: true });
  await tx.done;
}

// ---------- reads ----------

export const listAccounts = async () => (await db()).getAll('accounts');
export const listStatements = async () => ((await db()).getAll('statements')).then((s) => s.sort((a, b) => b.statementDate.localeCompare(a.statementDate)));
export const listTxns = async () => ((await db()).getAll('txns')).then((t) => t.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)));
export const listCategories = async () => ((await db()).getAll('categories')).then((c) => c.sort((a, b) => a.order - b.order));
export const listRules = async () => ((await db()).getAll('rules')).then((r) => r.sort((a, b) => a.keyword.localeCompare(b.keyword)));
export const getStatement = async (id: string) => (await db()).get('statements', id);

// ---------- statements ----------

/** Adds accounts (if new), the statement and its txns in one transaction. Caller checks duplicates first. */
export async function addStatement(id: string, s: ParsedStatement): Promise<Txn[]> {
  const d = await db();
  const tx = d.transaction(['accounts', 'statements', 'txns'], 'readwrite');
  const now = Date.now();
  for (const a of s.accounts) {
    const existing = await tx.objectStore('accounts').get(a.key);
    if (existing) continue;
    const name = `${a.product}${a.holderRole === 'S' ? ' (supp)' : ''} ·${a.last4}`;
    await tx.objectStore('accounts').put({ id: a.key, bank: a.bank, kind: a.kind, name, product: a.product, last4: a.last4, holderRole: a.holderRole, parentId: a.parentKey, createdAt: now, updatedAt: now });
  }
  await tx.objectStore('statements').put({
    id,
    parserId: s.parserId,
    label: s.label,
    statementDate: s.statementDate,
    accountIds: s.accounts.map((a) => a.key),
    txnCount: s.txns.length,
    reconciled: s.checks.every((c) => c.ok),
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  const txns: Txn[] = s.txns.map((t, i) => ({
    id: `${id}#${i}`,
    statementId: id,
    accountId: t.accountKey,
    date: t.date,
    description: t.description,
    merchant: t.merchant,
    amountSen: t.amountSen,
    balanceSen: t.balanceSen,
    categoryId: '',
    catSource: '',
    transferPairId: null,
    note: '',
    createdAt: now,
    updatedAt: now,
  }));
  for (const t of txns) await tx.objectStore('txns').put(t);
  await tx.done;
  return txns;
}

/** Removes the statement and its txns; unpairs anything they were paired with. */
export async function deleteStatement(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['statements', 'txns'], 'readwrite');
  const store = tx.objectStore('txns');
  const gone = new Set(await store.index('byStatement').getAllKeys(id));
  for (const k of gone) await store.delete(k);
  const now = Date.now();
  for (const t of await store.getAll())
    if (t.transferPairId && gone.has(t.transferPairId))
      await store.put({ ...t, transferPairId: null, ...(t.catSource === 'transfer' ? { categoryId: '', catSource: '' as const } : {}), updatedAt: now });
  await tx.objectStore('statements').delete(id);
  await tx.done;
}

// ---------- txns / accounts ----------

export async function putTxns(txns: Txn[]): Promise<void> {
  if (!txns.length) return;
  const tx = (await db()).transaction('txns', 'readwrite');
  for (const t of txns) await tx.store.put(t);
  await tx.done;
}

export async function updateTxn(id: string, patch: Partial<Pick<Txn, 'categoryId' | 'catSource' | 'note' | 'transferPairId'>>): Promise<void> {
  const d = await db();
  const t = await d.get('txns', id);
  if (t) await d.put('txns', { ...t, ...patch, updatedAt: Date.now() });
}

export async function updateAccount(id: string, patch: Partial<Pick<Account, 'name' | 'parentId'>>): Promise<void> {
  const d = await db();
  const a = await d.get('accounts', id);
  if (a) await d.put('accounts', { ...a, ...patch, updatedAt: Date.now() });
}

// ---------- categories / rules ----------

export async function saveCategory(input: Pick<Category, 'name' | 'emoji' | 'bucket'> & { id?: string; zakatDeduct?: boolean }): Promise<Category> {
  const name = input.name.trim();
  if (!name) throw new Error('Nama kena isi');
  const d = await db();
  const now = Date.now();
  const existing = input.id ? await d.get('categories', input.id) : undefined;
  const order = existing?.order ?? (await d.getAll('categories')).reduce((m, c) => Math.max(m, c.order + 1), 0);
  const c: Category = { id: existing?.id ?? uid(), name, emoji: input.emoji.trim(), bucket: input.bucket, zakatDeduct: canDeduct(input.bucket) && (input.zakatDeduct ?? input.bucket === 'keperluan'), order, createdAt: existing?.createdAt ?? now, updatedAt: now };
  await d.put('categories', c);
  return c;
}

/** Its txns become belum kategori and its rules are removed. */
export async function deleteCategory(id: string): Promise<void> {
  if (id === TRANSFER_CATEGORY_ID) throw new Error('Kategori Pindahan tak boleh delete');
  const d = await db();
  const tx = d.transaction(['categories', 'txns', 'rules'], 'readwrite');
  await tx.objectStore('categories').delete(id);
  const now = Date.now();
  for (const t of await tx.objectStore('txns').getAll()) if (t.categoryId === id) await tx.objectStore('txns').put({ ...t, categoryId: '', catSource: '', updatedAt: now });
  for (const r of await tx.objectStore('rules').getAll()) if (r.categoryId === id) await tx.objectStore('rules').delete(r.id);
  await tx.done;
}

export async function saveRule(input: Pick<Rule, 'keyword' | 'categoryId'> & { id?: string }): Promise<Rule> {
  const keyword = input.keyword.trim().toUpperCase();
  if (keyword.length < 2) throw new Error('Keyword pendek sangat');
  const d = await db();
  const now = Date.now();
  const all = await d.getAll('rules');
  const existing = all.find((r) => r.id === input.id) ?? all.find((r) => r.keyword === keyword);
  const r: Rule = { id: existing?.id ?? uid(), keyword, categoryId: input.categoryId, createdAt: existing?.createdAt ?? now, updatedAt: now };
  await d.put('rules', r);
  return r;
}

export const deleteRule = async (id: string) => (await db()).delete('rules', id);

// ---------- meta ----------

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', { key, value });
}

// ---------- bulk (backup) ----------

const STORES = ['accounts', 'statements', 'txns', 'categories', 'rules'] as const;
/** Settings that travel with a backup. */
const META_KEYS = ['zakat'];

export async function exportAll(): Promise<UserData & { meta: Record<string, unknown> }> {
  const d = await db();
  const [accounts, statements, txns, categories, rules] = await Promise.all(STORES.map((s) => d.getAll(s)));
  const meta: Record<string, unknown> = {};
  for (const k of META_KEYS) {
    const v = await getMeta(k);
    if (v !== undefined) meta[k] = v;
  }
  return { accounts, statements, txns, categories, rules, meta } as UserData & { meta: Record<string, unknown> };
}

/** replace: wipe then write. merge: by id, newer updatedAt wins. One transaction. */
export async function importAll(data: UserData & { meta?: Record<string, unknown> }, mode: 'replace' | 'merge'): Promise<void> {
  const d = await db();
  const tx = d.transaction([...STORES, 'meta' as const], 'readwrite');
  for (const name of STORES) {
    const store = tx.objectStore(name);
    if (mode === 'replace') await store.clear();
    for (const rec of data[name]) {
      if (mode === 'merge') {
        const local = await store.get(rec.id);
        if (local && local.updatedAt >= rec.updatedAt) continue;
      }
      await store.put(rec as never);
    }
  }
  const meta = tx.objectStore('meta');
  for (const [key, value] of Object.entries(data.meta ?? {})) if (META_KEYS.includes(key) && (mode === 'replace' || !(await meta.get(key)))) await meta.put({ key, value });
  await meta.put({ key: 'seeded', value: true });
  await tx.done;
}

export async function deleteAll(): Promise<void> {
  const d = await db();
  const stores = [...STORES, 'meta'] as const;
  const tx = d.transaction([...stores], 'readwrite');
  await Promise.all(stores.map((s) => tx.objectStore(s).clear()));
  await tx.done;
}
