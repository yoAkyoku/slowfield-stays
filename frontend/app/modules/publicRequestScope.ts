/** Merge trusted request scope without overwriting an explicitly selected site. */
export function withPublicRequestScope(path: string, scopeQuery: string): string {
  if (!scopeQuery) return path;
  const url = new URL(path, "http://internal.invalid");
  const scope = new URLSearchParams(scopeQuery.replace(/^\?/, ""));
  for (const key of ["host", "site"]) {
    if (!url.searchParams.has(key) && scope.has(key)) url.searchParams.set(key, scope.get(key)!);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
