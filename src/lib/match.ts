/** True if two artist names are the same after loose normalization. */
export function sameArtist(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
  const na = norm(a);
  return na.length > 0 && na === norm(b);
}
