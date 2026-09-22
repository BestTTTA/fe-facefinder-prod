// Sequential bulk actions. The API has no batch endpoint, so a "delete selected"
// is N requests — run one at a time so a per-minute rate limit stays predictable,
// and report partial progress instead of failing the whole set on the first error.

export type BulkProgress = { done: number; total: number };
export type BulkOutcome<T> = { ok: T[]; failed: { id: T; message: string }[] };

export async function bulkRun<T>(
  ids: T[],
  fn: (id: T) => Promise<unknown>,
  onProgress?: (p: BulkProgress) => void,
): Promise<BulkOutcome<T>> {
  const ok: T[] = [];
  const failed: { id: T; message: string }[] = [];
  let done = 0;
  for (const id of ids) {
    try {
      await fn(id);
      ok.push(id);
    } catch (e) {
      failed.push({ id, message: e instanceof Error ? e.message : "failed" });
    }
    done += 1;
    onProgress?.({ done, total: ids.length });
  }
  return { ok, failed };
}

/** Toggle one id inside a Set, returning a new Set (state-safe). */
export function toggleId<T>(set: Set<T>, id: T): Set<T> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
