import type { AtlasIndex } from "./atlas";
import type { RelKind } from "./types";
import { REL_KINDS } from "./types";

export const ATLAS_ROOT = "__atlas";
/** Haritada aynı anda çizilecek en fazla düğüm; aşılırsa en eski genişletmeler daraltılır. */
export const MAX_GRAPH_NODES = 450;

export interface GraphNode {
  id: string;
  label: string;
  depth: number;
  disc: string | null;
  childCount: number;
  expanded: boolean;
  /** Hiyerarşide görünür değil; yalnızca seçili düğümün ilişkisi olarak eklendi */
  ghost: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "child" | RelKind;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Kademeli harita: kök + ana disiplinler, ardından yalnızca genişletilmiş düğümlerin çocukları.
 * Hiyerarşi kenarları (child) ile ön bilgideki ilişki kenarları (related, depends_on, applied_in) ayrı türdedir.
 */
export function buildGraph(
  index: AtlasIndex,
  expanded: Set<string>,
  opts: { selected: string | null; showRelations: boolean },
): GraphModel {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const present = new Set<string>();
  const add = (id: string, ghost: boolean) => {
    const n = index.byId.get(id)!;
    present.add(id);
    nodes.push({
      id,
      label: n.tr,
      depth: n.depth,
      disc: n.disc,
      childCount: n.children.length,
      expanded: !ghost && expanded.has(id),
      ghost,
    });
  };
  nodes.push({
    id: ATLAS_ROOT, label: "Atlas", depth: 0, disc: null,
    childCount: index.atlas.roots.length, expanded: true, ghost: false,
  });
  const visit = (id: string, parent: string) => {
    add(id, false);
    edges.push({ id: `c:${parent}>${id}`, source: parent, target: id, kind: "child" });
    if (expanded.has(id)) for (const c of index.byId.get(id)!.children) visit(c, id);
  };
  for (const r of index.atlas.roots) visit(r, ATLAS_ROOT);

  const sel = opts.selected && index.byId.has(opts.selected) ? opts.selected : null;
  if (opts.showRelations || sel) {
    const seen = new Set<string>();
    const relEdge = (from: string, to: string, kind: RelKind) => {
      const key = `${kind}:${from}>${to}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ id: `r:${key}`, source: from, target: to, kind });
    };
    // Seçili düğümün tüm ilişkileri gösterilir; gerekirse hiyerarşide görünmeyen uçlar "hayalet" olarak eklenir.
    if (sel) {
      const n = index.byId.get(sel)!;
      for (const kind of REL_KINDS) {
        for (const t of n.rel[kind]) {
          if (!present.has(t)) add(t, true);
          relEdge(sel, t, kind);
        }
      }
      for (const inc of index.incoming.get(sel) ?? []) {
        if (!present.has(inc.from)) add(inc.from, true);
        relEdge(inc.from, sel, inc.kind);
      }
    }
    if (opts.showRelations) {
      for (const id of [...present]) {
        const n = index.byId.get(id)!;
        for (const kind of REL_KINDS) for (const t of n.rel[kind]) if (present.has(t)) relEdge(id, t, kind);
      }
    }
  }
  return { nodes, edges };
}

/** Bir düğüme odaklanmak için gereken genişletme kümesi: atalar ve düğümün kendisi. */
export function focusExpansion(index: AtlasIndex, id: string): Set<string> {
  const out = new Set<string>();
  let cur: string | null = id;
  while (cur) {
    out.add(cur);
    cur = index.byId.get(cur)?.parent ?? null;
  }
  return out;
}

/** Genişletme kümesindeki görünür düğüm sayısı (kök hariç). */
export function countVisible(index: AtlasIndex, expanded: Set<string>): number {
  let count = 0;
  const visit = (id: string) => {
    count++;
    if (expanded.has(id)) index.byId.get(id)!.children.forEach(visit);
  };
  index.atlas.roots.forEach(visit);
  return count;
}

/**
 * Yeni bir düğüm genişletildiğinde sınır aşılıyorsa, korunması gerekenler (odak yolu) dışında
 * en eski genişletmeleri kapatır. `order` genişletme sırasıdır (eskiden yeniye).
 */
export function enforceLimit(index: AtlasIndex, order: string[], keep: Set<string>, limit = MAX_GRAPH_NODES): string[] {
  const result = [...order];
  while (countVisible(index, new Set(result)) > limit) {
    const i = result.findIndex((id) => !keep.has(id));
    if (i < 0) break;
    result.splice(i, 1);
  }
  return result;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Radyal ağaç yerleşimi: her düğüme, görünür alt ağacındaki yaprak sayısının kuvvetiyle (0,6) orantılı bir açı
 * dilimi verilir; böylece açık dallar yer kazanırken kapalı kardeşler tek noktaya sıkışmaz.
 * Halka yarıçapları, en kalabalık halkada etiketler üst üste binmeyecek kadar büyütülür.
 */
export function radialLayout(model: GraphModel, minArc = 46, ringGap = 150): Map<string, Point> {
  const kids = new Map<string, string[]>();
  for (const e of model.edges) {
    if (e.kind !== "child") continue;
    if (!kids.has(e.source)) kids.set(e.source, []);
    kids.get(e.source)!.push(e.target);
  }
  const leaves = new Map<string, number>();
  const countLeaves = (id: string): number => {
    const c = kids.get(id) ?? [];
    const v = c.length ? c.reduce((s, k) => s + countLeaves(k), 0) : 1;
    leaves.set(id, v);
    return v;
  };
  countLeaves(ATLAS_ROOT);
  const weight = (id: string) => Math.pow(leaves.get(id)!, 0.6);

  const angle = new Map<string, number>();
  const depthOf = new Map<string, number>([[ATLAS_ROOT, 0]]);
  const perDepth: number[] = [];
  const assign = (id: string, start: number, span: number, depth: number) => {
    angle.set(id, start + span / 2);
    depthOf.set(id, depth);
    perDepth[depth] = (perDepth[depth] ?? 0) + 1;
    const children = kids.get(id) ?? [];
    const total = children.reduce((t, k) => t + weight(k), 0);
    let a = start;
    for (const k of children) {
      const s = (span * weight(k)) / total;
      assign(k, a, s, depth + 1);
      a += s;
    }
  };
  assign(ATLAS_ROOT, -Math.PI / 2, 2 * Math.PI, 0);

  const radius: number[] = [0];
  for (let d = 1; d < perDepth.length; d++) {
    const need = (perDepth[d] * minArc) / (2 * Math.PI);
    radius[d] = Math.max(radius[d - 1] + ringGap, need);
  }
  const out = new Map<string, Point>();
  for (const [id, a] of angle) {
    const r = radius[depthOf.get(id)!];
    out.set(id, { x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return out;
}
