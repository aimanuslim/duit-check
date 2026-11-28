import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { importStatement } from '../src/actions';
import { buildBackupText, NeedsPassphrase, parseBackup, applyImport } from '../src/backup';
import { deleteAll, exportAll, listTxns, seedIfEmpty, setMeta } from '../src/db';
import { parseLines } from '../src/parse';
import { ambankCardLines, maybankSavingsLines } from './fixtures';

beforeEach(async () => {
  await deleteAll();
  await seedIfEmpty();
});

describe('backup', () => {
  it('export -> wipe -> import round-trips identical data', async () => {
    await importStatement(parseLines(maybankSavingsLines));
    await importStatement(parseLines(ambankCardLines));
    await setMeta('zakat', { method: 'tolakan', nisab: { '2026': 2_500_000 } });
    const before = await exportAll();
    const text = await buildBackupText();
    await deleteAll();
    await applyImport(await parseBackup(text), 'replace');
    expect(await exportAll()).toEqual(before);
  });

  it('encrypted backup needs the right passphrase', async () => {
    await importStatement(parseLines(maybankSavingsLines));
    const text = await buildBackupText('rahsia');
    expect(text).not.toContain('SYARIKAT');
    await expect(parseBackup(text)).rejects.toBeInstanceOf(NeedsPassphrase);
    await expect(parseBackup(text, 'salah')).rejects.toBeInstanceOf(NeedsPassphrase);
    expect((await parseBackup(text, 'rahsia')).data.txns).toHaveLength(3);
  });

  it('import auto-categorises and refuses the same statement twice', async () => {
    const r = await importStatement(parseLines(ambankCardLines));
    expect(r.count).toBe(4);
    await expect(importStatement(parseLines(ambankCardLines))).rejects.toThrow(/dah import/);
    const cats = (await listTxns()).map((t) => [t.merchant, t.catSource]);
    expect(cats).toContainEqual(['GIANT HYPER SHAH ALAM', 'rule']);
  });

  it('rejects other apps', async () => {
    await expect(parseBackup(JSON.stringify({ app: 'bila-last', schemaVersion: 1, data: {} }))).rejects.toThrow(/bukan backup/);
  });
});
