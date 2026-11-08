import type { Atlas, AtlasWire, NodeDetail, RelKind, ResearchDetail, ResearchItem, TechNode } from "./types";
import { REL_KINDS } from "./types";
import { normalize } from "./search";

export interface Incoming {
  from: string;
  kind: RelKind;
}

export interface AtlasIndex {
  atlas: Atlas;
  byId: Map<string, TechNode>;
  /** Hiyerarşi dışı ilişkilerin ters yönü */
  incoming: Map<string, Incoming[]>;
  researchByKey: Map<string, ResearchItem>;
  /** Kanonik konumu bu düğüm olan araştırmalar */
  researchByTech: Map<string, ResearchItem[]>;
  /** related_technologies alanında bu düğümü anan araştırmalar */
  researchMentioning: Map<string, ResearchItem[]>;
  /** Arama için ön işlenmiş metinler (düğüm sırasıyla) */
  searchText: { tr: string; en: string; aliases: string[]; id: string }[];
  disciplineColor: Map<string, number>;
}

export function hydrate(wire: AtlasWire): AtlasIndex {
  const nodes: TechNode[] = wire.nodes.map((n) => ({
    ...n,
    children: [],
    rel: { related: n.rel?.related ?? [], depends_on: n.rel?.depends_on ?? [], applied_in: n.rel?.applied_in ?? [] },
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  // Düğümler derinlik öncelikli sırada geldiği için çocuk sırası korunur.
  for (const n of nodes) if (n.parent) byId.get(n.parent)?.children.push(n.id);

  const incoming = new Map<string, Incoming[]>();
  for (const n of nodes) {
    for (const kind of REL_KINDS) {
      for (const t of n.rel[kind]) {
        if (!incoming.has(t)) incoming.set(t, []);
        incoming.get(t)!.push({ from: n.id, kind });
      }
    }
  }

  const researchByKey = new Map(wire.research.map((r) => [r.key, r]));
  const researchByTech = new Map<string, ResearchItem[]>();
  const researchMentioning = new Map<string, ResearchItem[]>();
  for (const r of wire.research) {
    if (!researchByTech.has(r.tech)) researchByTech.set(r.tech, []);
    researchByTech.get(r.tech)!.push(r);
    for (const t of r.related) {
      if (!researchMentioning.has(t)) researchMentioning.set(t, []);
      researchMentioning.get(t)!.push(r);
    }
  }
  const byCitation = (a: ResearchItem, b: ResearchItem) =>
    (b.cited ?? 0) - (a.cited ?? 0) || (b.year ?? 0) - (a.year ?? 0) || a.title.localeCompare(b.title, "tr");
  for (const l of researchByTech.values()) l.sort(byCitation);
  for (const l of researchMentioning.values()) l.sort(byCitation);

  const searchText = nodes.map((n) => ({
    tr: normalize(n.tr),
    en: normalize(n.en),
    aliases: n.aliases.map(normalize),
    id: n.id,
  }));
  const disciplineColor = new Map(wire.roots.map((id, i) => [id, i]));

  return {
    atlas: { ...wire, nodes },
    byId,
    incoming,
    researchByKey,
    researchByTech,
    researchMentioning,
    searchText,
    disciplineColor,
  };
}

export function ancestors(index: AtlasIndex, id: string): string[] {
  const out: string[] = [];
  let cur = index.byId.get(id)?.parent ?? null;
  while (cur) {
    out.unshift(cur);
    cur = index.byId.get(cur)?.parent ?? null;
  }
  return out;
}

/** Bir düğümün alt ağacındaki tüm araştırmalar (kendisi hariç). */
export function descendantResearch(index: AtlasIndex, id: string): ResearchItem[] {
  const out: ResearchItem[] = [];
  const stack = [...(index.byId.get(id)?.children ?? [])];
  while (stack.length) {
    const c = stack.pop()!;
    out.push(...(index.researchByTech.get(c) ?? []));
    stack.push(...(index.byId.get(c)?.children ?? []));
  }
  return out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.cited ?? 0) - (a.cited ?? 0));
}

const VERSION = process.env.NEXT_PUBLIC_DATA_VERSION ?? "dev";
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  const full = `${url}?v=${VERSION}`;
  if (!cache.has(full)) {
    const p = fetch(full).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(full));
    cache.set(full, p);
  }
  return cache.get(full) as Promise<T>;
}

export const loadAtlas = () => getJson<AtlasWire>("/data/atlas.json").then(hydrate);
export const loadNodeDetail = (id: string) => getJson<NodeDetail>(`/data/n/${encodeURIComponent(id)}.json`);
export const loadResearchDetail = (key: string) => getJson<ResearchDetail>(`/data/r/${encodeURIComponent(key)}.json`);
