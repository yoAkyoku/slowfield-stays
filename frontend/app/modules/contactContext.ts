/** Only positive integer stay identifiers can be forwarded from a detail link. */
export function stayIdFromSearch(search: string): number | undefined {
  const raw = new URLSearchParams(search).get("stay");
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
