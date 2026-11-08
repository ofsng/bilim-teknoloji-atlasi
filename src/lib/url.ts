/** Paylaşılabilir durum: ?t=<teknoloji-id> ya da ?r=<araştırma-anahtarı>. */
export interface UrlState {
  tech: string | null;
  research: string | null;
}

export function readUrl(search: string): UrlState {
  const p = new URLSearchParams(search);
  return { tech: p.get("t"), research: p.get("r") };
}

export function buildUrl(s: UrlState): string {
  const p = new URLSearchParams();
  if (s.tech) p.set("t", s.tech);
  if (s.research) p.set("r", s.research);
  const q = p.toString();
  return q ? `?${q}` : "./";
}

export function shareUrl(origin: string, pathname: string, s: UrlState): string {
  const q = buildUrl(s);
  return origin + pathname + (q === "./" ? "" : q);
}
