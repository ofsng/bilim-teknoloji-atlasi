import { describe, it, expect, beforeAll } from "vitest";
import { buildAtlas, toWire } from "../../scripts/lib/atlas";
import { resolveKb } from "../../scripts/lib/source";
import { hydrate, ancestors, descendantResearch, type AtlasIndex } from "@/lib/atlas";
import { search, normalize, DEFAULT_FILTERS, matchesFilters, filtersActive } from "@/lib/search";
import { flattenTree, visibleSet, allExpandable } from "@/lib/tree";
import { buildGraph, focusExpansion, enforceLimit, countVisible, radialLayout, ATLAS_ROOT, MAX_GRAPH_NODES } from "@/lib/graph";
import { readUrl, buildUrl } from "@/lib/url";
import { REL_KINDS } from "@/lib/types";

let ix: AtlasIndex;
beforeAll(() => {
  const { atlas } = buildAtlas(resolveKb(), { repo: "ofsng/teknoloji", commit: null, commitDate: null });
  ix = hydrate(JSON.parse(JSON.stringify(toWire(atlas))));
});
const deepest = () => ix.atlas.nodes.reduce((a, b) => (b.depth > a.depth ? b : a));

describe("arama", () => {
  it("Türkçe karakter ve büyük/küçük harf duyarsızdır", () => {
    expect(normalize("İŞLEMCİ Çoğu ĞÜÖ ı")).toBe("islemci cogu guo i");
    const a = search(ix, "kuantum hata düzeltme").hits[0];
    const b = search(ix, "KUANTUM HATA DUZELTME").hits[0];
    expect(a.id).toBe(b.id);
    expect(ix.byId.get(a.id)!.tr).toBe("Kuantum Hata Düzeltme");
  });

  it("Türkçe ad, özgün ad ve takma adla bulur; tam eşleşme önce gelir", () => {
    expect(search(ix, "Quantum Error Correction").hits[0].id).toBe("quantum-error-correction");
    expect(search(ix, "QEC").hits.map((h) => h.id)).toContain("quantum-error-correction");
    for (const n of ix.atlas.nodes.filter((_, i) => i % 97 === 0)) {
      const hits = search(ix, n.tr, DEFAULT_FILTERS, 5000).hits.map((h) => h.id);
      expect(hits, n.tr).toContain(n.id);
    }
  });

  it("her düğüm adıyla erişilebilir (3.492 düğümün tamamı)", () => {
    let found = 0;
    for (const n of ix.atlas.nodes) if (search(ix, n.tr, DEFAULT_FILTERS, 10000).hits.some((h) => h.id === n.id)) found++;
    expect(found).toBe(ix.atlas.nodes.length);
  });

  it("filtreler sonuçları disipline ve derinliğe göre daraltır", () => {
    const disc = "quantum-science-and-technology";
    const f = { ...DEFAULT_FILTERS, disciplines: [ix.byId.has(disc) ? disc : ix.atlas.roots[0]], depthMin: 3, depthMax: 4 };
    const { hits } = search(ix, "a", f, 10000);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      const n = ix.byId.get(h.id)!;
      expect(f.disciplines).toContain(n.disc);
      expect(n.depth).toBeGreaterThanOrEqual(3);
      expect(n.depth).toBeLessThanOrEqual(4);
    }
    expect(filtersActive(f, ix.atlas.stats.maxDepth)).toBe(true);
    expect(filtersActive({ ...DEFAULT_FILTERS, depthMax: ix.atlas.stats.maxDepth }, ix.atlas.stats.maxDepth)).toBe(false);
  });

  it("boş sorgu sonuç döndürmez", () => {
    expect(search(ix, "   ").total).toBe(0);
  });
});

describe("ağaç", () => {
  it("başlangıçta yalnızca ana disiplinler görünür; genişletme çocukları sırasıyla ekler", () => {
    expect(flattenTree(ix, new Set(), null).map((r) => r.id)).toEqual(ix.atlas.roots);
    const root = ix.atlas.roots[0];
    const rows = flattenTree(ix, new Set([root]), null);
    expect(rows.slice(1, 1 + ix.byId.get(root)!.children.length).map((r) => r.id)).toEqual(ix.byId.get(root)!.children);
    expect(rows[1].level).toBe(2);
    expect(rows[0].expanded).toBe(true);
  });

  it("tümü açıldığında 3.492 düğümün hepsi ağaçta yer alır", () => {
    const rows = flattenTree(ix, allExpandable(ix, null), null);
    expect(rows.length).toBe(ix.atlas.nodes.length);
    expect(new Set(rows.map((r) => r.id)).size).toBe(ix.atlas.nodes.length);
  });

  it("filtreyle eşleşen düğümler ataları bağlam olarak gösterilerek listelenir", () => {
    const f = { ...DEFAULT_FILTERS, depthMin: 5, depthMax: 5 };
    const vis = visibleSet(ix, f)!;
    const rows = flattenTree(ix, allExpandable(ix, vis), vis);
    const matches = rows.filter((r) => !r.context);
    expect(matches.length).toBe(ix.atlas.nodes.filter((n) => matchesFilters(n, f)).length);
    for (const r of rows) {
      if (r.context) expect(ix.byId.get(r.id)!.depth).toBeLessThan(5);
    }
  });

  it("derin bir düğümün ataları kökten başlayarak sıralanır", () => {
    const d = deepest();
    const anc = ancestors(ix, d.id);
    expect(anc.length).toBe(d.depth - 1);
    expect(anc[0]).toBe(d.disc);
    expect(ix.byId.get(anc[anc.length - 1])!.children).toContain(d.id);
  });
});

describe("harita modeli", () => {
  it("başlangıç: kök + ana disiplinler, yalnızca hiyerarşi kenarları", () => {
    const g = buildGraph(ix, new Set(), { selected: null, showRelations: false });
    expect(g.nodes.length).toBe(ix.atlas.roots.length + 1);
    expect(g.edges.every((e) => e.kind === "child" && e.source === ATLAS_ROOT)).toBe(true);
  });

  it("hiyerarşi kenarları ile ilişki kenarları ayrı türdedir ve karışmaz", () => {
    const withRel = ix.atlas.nodes.find((n) => REL_KINDS.some((k) => n.rel[k].length))!;
    const exp = focusExpansion(ix, withRel.id);
    const g = buildGraph(ix, exp, { selected: withRel.id, showRelations: false });
    const child = g.edges.filter((e) => e.kind === "child");
    const rel = g.edges.filter((e) => e.kind !== "child");
    for (const e of child) {
      if (e.source !== ATLAS_ROOT) expect(ix.byId.get(e.target)!.parent).toBe(e.source);
    }
    const outgoing = REL_KINDS.flatMap((k) => withRel.rel[k].map((t) => `${k}:${withRel.id}>${t}`));
    for (const o of outgoing) expect(rel.map((e) => `${e.kind}:${e.source}>${e.target}`)).toContain(o);
    // Görünür olmayan ilişki uçları hayalet olarak eklenir, hiyerarşi kenarı almaz.
    for (const n of g.nodes.filter((x) => x.ghost)) expect(child.some((e) => e.target === n.id)).toBe(false);
  });

  it("odak: atalar ve düğüm genişler, en derin düğüm de görünür olur", () => {
    const d = deepest();
    const exp = focusExpansion(ix, d.id);
    const g = buildGraph(ix, exp, { selected: d.id, showRelations: false });
    expect(g.nodes.some((n) => n.id === d.id && !n.ghost)).toBe(true);
    expect(g.nodes.length).toBeLessThan(MAX_GRAPH_NODES);
  });

  it("sınır aşılırsa eski genişletmeler daraltılır, odak yolu korunur", () => {
    const all = ix.atlas.nodes.filter((n) => n.children.length).map((n) => n.id);
    const keep = focusExpansion(ix, deepest().id);
    const order = enforceLimit(ix, [...all, ...keep], keep);
    expect(countVisible(ix, new Set(order))).toBeLessThanOrEqual(MAX_GRAPH_NODES);
    for (const k of keep) expect(order).toContain(k);
  });

  it("radyal yerleşim sonlu ve çakışmayan konumlar üretir", () => {
    const g = buildGraph(ix, focusExpansion(ix, deepest().id), { selected: null, showRelations: false });
    const pos = radialLayout(g);
    expect(pos.size).toBe(g.nodes.length);
    const seen = new Set<string>();
    for (const p of pos.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      const k = `${Math.round(p.x)},${Math.round(p.y)}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });
});

describe("araştırma ilişkilendirme ve URL", () => {
  it("alt ağaç araştırmaları resAll ile tutarlıdır", () => {
    for (const root of ix.atlas.roots) {
      const n = ix.byId.get(root)!;
      expect(descendantResearch(ix, root).length + (ix.researchByTech.get(root)?.length ?? 0)).toBe(n.resAll);
    }
  });

  it("paylaşılabilir URL gidiş-dönüş", () => {
    expect(buildUrl({ tech: "quantum-error-correction", research: null })).toBe("?t=quantum-error-correction");
    expect(readUrl("?t=a-b&r=0123abcd")).toEqual({ tech: "a-b", research: "0123abcd" });
    expect(buildUrl({ tech: null, research: null })).toBe("./");
  });
});
