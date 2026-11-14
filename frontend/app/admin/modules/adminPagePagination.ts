/** Fetch every page of an offset-based admin list without duplicate records. */
export async function collectAllPages<T extends { id: number }>(
  fetchPage: (skip: number, limit: number) => Promise<T[]>,
  pageSize: number,
): Promise<T[]> {
  const records = new Map<number, T>();
  let skip = 0;

  while (true) {
    const batch = await fetchPage(skip, pageSize);
    const previousSize = records.size;
    batch.forEach((record) => records.set(record.id, record));

    // Stop on a short final page and avoid looping if the service ignores offsets.
    if (batch.length < pageSize || records.size === previousSize) break;
    skip += batch.length;
  }

  return Array.from(records.values());
}
