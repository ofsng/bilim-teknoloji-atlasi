import type { AtlasIndex } from "./atlas";
import { matchesFilters, type Filters } from "./search";

export interface TreeRow {
  id: string;
  level: number;
  /** Filtreye uymayan ama eşleşen bir alt düğüme giden yolda olduğu için gösterilen */
  context: boolean;
  hasChildren: boolean;
  expanded: boolean;
  posInSet: number;
  setSize: number;
}

/** Filtreye uyan ya da alt ağacında uyan düğüm bulunan kimlikler. Filtre yoksa null (hepsi görünür). */
export function visibleSet(index: AtlasIndex, filters: Filters | null): { show: Set<string>; match: Set<string> } | null {
  if (!filters) return null;
  const show = new Set<string>();
  const match = new Set<string>();
  // Düğümler derinlik öncelikli sırada: tersten gezmek çocukları ebeveynden önce işler.
  const nodes = index.atlas.nodes;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (matchesFilters(n, filters)) {
      match.add(n.id);
      show.add(n.id);
    }
    if (show.has(n.id) && n.parent) show.add(n.parent);
  }
  return { show, match };
}

export function flattenTree(index: AtlasIndex, expanded: Set<string>, vis: ReturnType<typeof visibleSet>): TreeRow[] {
  const rows: TreeRow[] = [];
  const visit = (ids: string[], level: number) => {
    const shown = vis ? ids.filter((id) => vis.show.has(id)) : ids;
    shown.forEach((id, i) => {
      const n = index.byId.get(id)!;
      const kids = vis ? n.children.filter((c) => vis.show.has(c)) : n.children;
      const isOpen = expanded.has(id) && kids.length > 0;
      rows.push({
        id,
        level,
        context: vis ? !vis.match.has(id) : false,
        hasChildren: kids.length > 0,
        expanded: isOpen,
        posInSet: i + 1,
        setSize: shown.length,
      });
      if (isOpen) visit(n.children, level + 1);
    });
  };
  visit(index.atlas.roots, 1);
  return rows;
}

/** Görünür alt ağaçtaki tüm genişletilebilir düğümler ("tümünü genişlet"). */
export function allExpandable(index: AtlasIndex, vis: ReturnType<typeof visibleSet>): Set<string> {
  const out = new Set<string>();
  for (const n of index.atlas.nodes) {
    if (vis && !vis.show.has(n.id)) continue;
    if (n.children.some((c) => !vis || vis.show.has(c))) out.add(n.id);
  }
  return out;
}
