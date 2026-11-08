import type { AtlasIndex } from "./atlas";
import type { TechNode } from "./types";

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Büyük/küçük harf ve Türkçe karakter duyarsız karşılaştırma için metni sadeleştirir. */
export function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/i̇|[çğıöşüâîû]/g, (c) => TR[c] ?? c)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface Filters {
  /** Boşsa tüm disiplinler */
  disciplines: string[];
  depthMin: number;
  depthMax: number;
  /** Yalnızca arşivde araştırması olan düğümler (alt ağaç dahil değil) */
  withResearch: boolean;
  /** Yalnızca kaynaklı içeriği olan düğümler */
  withContent: boolean;
}

export const DEFAULT_FILTERS: Filters = { disciplines: [], depthMin: 1, depthMax: 8, withResearch: false, withContent: false };

export function filtersActive(f: Filters, maxDepth: number): boolean {
  return f.disciplines.length > 0 || f.depthMin > 1 || f.depthMax < maxDepth || f.withResearch || f.withContent;
}

export function matchesFilters(n: TechNode, f: Filters): boolean {
  if (f.disciplines.length && !f.disciplines.includes(n.disc)) return false;
  if (n.depth < f.depthMin || n.depth > f.depthMax) return false;
  if (f.withResearch && n.res === 0) return false;
  if (f.withContent && n.content === "empty") return false;
  return true;
}

export interface SearchHit {
  id: string;
  score: number;
  /** Eşleşen alan */
  field: "tr" | "en" | "alias" | "id";
}

function scoreText(text: string, q: string, words: string[]): number {
  if (!text) return 0;
  if (text === q) return 100;
  if (text.startsWith(q)) return 80;
  const tw = text.split(" ");
  if (tw.some((w) => w.startsWith(q))) return 60;
  // Çok sözcüklü sorgu: her sözcük bir sözcüğün başında
  if (words.length > 1 && words.every((qw) => tw.some((w) => w.startsWith(qw)))) return 50;
  if (text.includes(q)) return 30;
  return 0;
}

/** Düğüm adı, özgün ad, takma ad ve kimlikte anlık arama. Sonuçlar puan, sonra sığ derinlik ve ad uzunluğuyla sıralanır. */
export function search(index: AtlasIndex, query: string, filters: Filters = DEFAULT_FILTERS, limit = 200): { hits: SearchHit[]; total: number } {
  const q = normalize(query);
  if (!q) return { hits: [], total: 0 };
  const words = q.split(" ");
  const qid = q.replace(/ /g, "-");
  const hits: SearchHit[] = [];
  const nodes = index.atlas.nodes;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!matchesFilters(n, filters)) continue;
    const s = index.searchText[i];
    let best = 0;
    let field: SearchHit["field"] = "tr";
    const tr = scoreText(s.tr, q, words);
    if (tr > best) [best, field] = [tr + 5, "tr"];
    const en = scoreText(s.en, q, words);
    if (en > best) [best, field] = [en, "en"];
    for (const a of s.aliases) {
      const as = scoreText(a, q, words);
      if (as > best) [best, field] = [as - 2, "alias"];
    }
    if (!best && s.id.includes(qid)) [best, field] = [10, "id"];
    if (best > 0) hits.push({ id: n.id, score: best, field });
  }
  hits.sort((a, b) => {
    const na = index.byId.get(a.id)!;
    const nb = index.byId.get(b.id)!;
    return b.score - a.score || na.depth - nb.depth || na.tr.length - nb.tr.length || na.tr.localeCompare(nb.tr, "tr");
  });
  return { hits: hits.slice(0, limit), total: hits.length };
}
