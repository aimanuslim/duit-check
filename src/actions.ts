// Use-cases that combine storage + pure logic. Views call these.
import { addStatement, getStatement, listAccounts, listRules, listTxns, putTxns, saveRule, updateTxn } from './db';
import { recategorize } from './engine';
import { statementKey } from './parse';
import type { ParsedStatement } from './parse/types';

export async function isDuplicate(s: ParsedStatement): Promise<boolean> {
  return !!(await getStatement(statementKey(s)));
}

/** Re-run transfer pairing + rules over everything not set by hand. Returns how many changed. */
export async function applyRules(): Promise<number> {
  const [txns, accounts, rules] = await Promise.all([listTxns(), listAccounts(), listRules()]);
  const changed = recategorize(txns, accounts, rules);
  await putTxns(changed);
  return changed.length;
}

export async function importStatement(s: ParsedStatement): Promise<{ count: number; categorised: number }> {
  const id = statementKey(s);
  if (await getStatement(id)) throw new Error('Statement ni dah import sebelum ni.');
  const added = await addStatement(id, s);
  await applyRules();
  const ids = new Set(added.map((t) => t.id));
  const after = (await listTxns()).filter((t) => ids.has(t.id));
  return { count: added.length, categorised: after.filter((t) => t.categoryId).length };
}

/** Set by hand. categoryId '' = back to auto (rules decide again). */
export async function setCategory(txnId: string, categoryId: string): Promise<void> {
  await updateTxn(txnId, categoryId ? { categoryId, catSource: 'manual', transferPairId: null } : { categoryId: '', catSource: '', transferPairId: null });
  if (!categoryId) await applyRules();
}

/** Make a keyword rule and apply it right away. Returns how many txns it changed. */
export async function addRule(keyword: string, categoryId: string): Promise<number> {
  await saveRule({ keyword, categoryId });
  return applyRules();
}
