import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { expect, it } from 'vitest';
import { DB_NAME, listCategories } from '../src/db';

it('upgrades a v1 database: keperluan categories get zakatDeduct = true', async () => {
  const old = await openDB(DB_NAME, 1, {
    upgrade(db) {
      for (const s of ['accounts', 'statements', 'categories', 'rules']) db.createObjectStore(s, { keyPath: 'id' });
      db.createObjectStore('txns', { keyPath: 'id' }).createIndex('byStatement', 'statementId');
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  await old.put('categories', { id: 'a', name: 'Bil', emoji: '', bucket: 'keperluan', order: 0, createdAt: 0, updatedAt: 0 });
  await old.put('categories', { id: 'b', name: 'Fun', emoji: '', bucket: 'kehendak', order: 1, createdAt: 0, updatedAt: 0 });
  old.close();
  expect((await listCategories()).map((c) => [c.id, c.zakatDeduct])).toEqual([
    ['a', true],
    ['b', false],
  ]);
});
