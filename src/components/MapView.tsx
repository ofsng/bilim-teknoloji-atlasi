"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { type Core, type ElementDefinition, type StylesheetJson } from "cytoscape";
import type { AtlasIndex } from "@/lib/atlas";
import { buildGraph, radialLayout, ATLAS_ROOT, MAX_GRAPH_NODES } from "@/lib/graph";
import { matchesFilters, filtersActive, type Filters } from "@/lib/search";
import { disciplineColor } from "@/lib/colors";
import { fmt } from "@/lib/labels";
import { useTheme } from "./ThemeToggle";
import type { MapLayout } from "./TopBar";

interface Props {
  index: AtlasIndex;
  expanded: Set<string>;
  selected: string | null;
  filters: Filters;
  layout: MapLayout;
  onLayout: (l: MapLayout) => void;
  showRelations: boolean;
  onShowRelations: (v: boolean) => void;
  visible: boolean;
  fitToken: number;
  onTapNode: (id: string) => void;
  onReset: () => void;
}

function palette(dark: boolean) {
  return dark
    ? { fg: "#e6e6e3", muted: "#a3a6ab", line: "#3d4046", bg: "#141517", accent: "#8db4e8", rel: "#c9a86a", dim: 0.25 }
    : { fg: "#1b1c1e", muted: "#5d6066", line: "#b3b3ab", bg: "#fbfbfa", accent: "#1f4e8c", rel: "#9a6a12", dim: 0.22 };
}

function stylesheet(dark: boolean): StylesheetJson {
  const c = palette(dark);
  return [
    {
      selector: "node",
      style: {
        "background-color": "data(color)",
        width: "data(size)",
        height: "data(size)",
        label: "data(label)",
        color: c.fg,
        "font-size": 11,
        "font-family": "ui-sans-serif, system-ui, sans-serif",
        "text-valign": "bottom",
        "text-margin-y": 3,
        "text-wrap": "ellipsis",
        "text-max-width": "120px",
        "text-background-color": c.bg,
        "text-background-opacity": 0.75,
        "text-background-padding": "1px",
        "min-zoomed-font-size": 7,
        "border-width": 0,
        "overlay-opacity": 0,
      },
    },
    { selector: "node[?collapsed]", style: { "border-width": 2, "border-color": "data(color)", "background-opacity": 0.35 } },
    { selector: "node[depth = 1]", style: { "font-size": 12, "font-weight": 600 } },
    {
      selector: `node[id = "${ATLAS_ROOT}"]`,
      style: { "background-color": c.muted, label: "", width: 10, height: 10 },
    },
    { selector: "node[?ghost]", style: { "background-opacity": 0.15, "border-width": 1.5, "border-style": "dashed", "border-color": c.rel, color: c.muted } },
    { selector: "node[?dim]", style: { opacity: c.dim } },
    {
      selector: "node:selected, node[?sel]",
      style: { "border-width": 3, "border-color": c.accent, "border-style": "solid", "font-weight": 700, "z-index": 10, opacity: 1 },
    },
    {
      selector: "edge",
      style: { width: 1, "line-color": c.line, "curve-style": "straight", "target-arrow-shape": "none", "overlay-opacity": 0 },
    },
    {
      selector: "edge[kind != 'child']",
      style: { "line-color": c.rel, "line-style": "dashed", "line-dash-pattern": [5, 4], width: 1.4, "curve-style": "unbundled-bezier", "control-point-distances": [30], "control-point-weights": [0.5], "target-arrow-color": c.rel, "arrow-scale": 0.8 },
    },
    { selector: "edge[kind = 'depends_on']", style: { "target-arrow-shape": "triangle" } },
    { selector: "edge[kind = 'applied_in']", style: { "target-arrow-shape": "vee" } },
    { selector: "edge[kind = 'related']", style: { "line-dash-pattern": [2, 3] } },
  ];
}

export default function MapView(p: Props) {
  const { index } = p;
  const theme = useTheme();
  const dark = theme === "dark";
  const box = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const tapRef = useRef(p.onTapNode);
  tapRef.current = p.onTapNode;
  const [info, setInfo] = useState("");
  const firstLayout = useRef(true);
  const needsFit = useRef(false);
  const selectedRef = useRef(p.selected);
  selectedRef.current = p.selected;

  const model = useMemo(
    () => buildGraph(index, p.expanded, { selected: p.selected, showRelations: p.showRelations }),
    [index, p.expanded, p.selected, p.showRelations],
  );

  // Cytoscape örneği bir kez oluşturulur.
  useEffect(() => {
    if (!box.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cy = cytoscape({
      container: box.current,
      style: stylesheet(document.documentElement.dataset.theme === "dark"),
      minZoom: 0.05,
      maxZoom: 3,
      wheelSensitivity: 0.25,
      boxSelectionEnabled: false,
      autoungrabify: false,
      selectionType: "single",
      textureOnViewport: true,
      hideEdgesOnViewport: true,
      pixelRatio: "auto",
    });
    cy.scratch("reduce", reduce);
    cy.on("tap", "node", (e) => {
      const id = e.target.id();
      if (id !== ATLAS_ROOT) tapRef.current(id);
    });
    cy.on("mouseover", "node", (e) => {
      const n = e.target;
      if (n.id() === ATLAS_ROOT) return;
      box.current!.style.cursor = "pointer";
      setInfo(n.data("tip"));
    });
    cy.on("mouseout", "node", () => {
      box.current!.style.cursor = "";
      setInfo("");
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    cyRef.current?.style(stylesheet(dark));
  }, [dark]);

  // Model değişince öğeleri farkla güncelle ve yerleşimi yeniden çalıştır.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const total = index.atlas.roots.length;
    const fActive = filtersActive(p.filters, index.atlas.stats.maxDepth);
    const els: ElementDefinition[] = [];
    for (const n of model.nodes) {
      const node = n.id === ATLAS_ROOT ? null : index.byId.get(n.id)!;
      const hue = n.disc ? index.disciplineColor.get(n.disc) ?? 0 : 0;
      els.push({
        group: "nodes",
        data: {
          id: n.id,
          label: n.label,
          depth: n.depth,
          color: n.disc ? disciplineColor(hue, total, dark) : "#888",
          size: n.depth === 0 ? 10 : Math.max(10, 30 - n.depth * 3.5),
          collapsed: !n.ghost && !n.expanded && n.childCount > 0,
          ghost: n.ghost,
          dim: !!node && fActive && !matchesFilters(node, p.filters),
          sel: n.id === p.selected,
          tip: node
            ? `${node.tr}${node.en && node.en !== node.tr ? ` (${node.en})` : ""} · ${node.children.length ? `${fmt.format(node.children.length)} alt düğüm` : "yaprak"}${node.resAll ? ` · ${fmt.format(node.resAll)} araştırma` : ""}${n.ghost ? " · ilişki ucu (hiyerarşide açık değil)" : ""}`
            : "",
        },
      });
    }
    for (const e of model.edges) els.push({ group: "edges", data: { id: e.id, source: e.source, target: e.target, kind: e.kind } });

    const wanted = new Set(els.map((e) => e.data.id!));
    cy.batch(() => {
      cy.elements().forEach((el) => {
        if (!wanted.has(el.id())) el.remove();
      });
      for (const def of els) {
        const ex = cy.getElementById(def.data.id!);
        if (ex.nonempty()) ex.data(def.data);
        else {
          const added = cy.add(def);
          // Yeni düğüm, üst düğümünün yanından başlasın (yerleşim geçişi daha okunur olur).
          if (def.group === "nodes") {
            const parent = index.byId.get(def.data.id!)?.parent ?? ATLAS_ROOT;
            const pe = cy.getElementById(parent);
            if (pe.nonempty()) added.position({ ...pe.position() });
          }
        }
      }
    });
    cy.$(":selected").unselect();

    const reduce = cy.scratch("reduce") as boolean;
    const animate = !reduce && !firstLayout.current && cy.nodes().length < 350;
    const radial = p.layout === "radial";
    // Yerleşim yalnızca hiyerarşiye göre yapılır; ilişki kenarları ve hayalet uçlar ağacın biçimini değiştirmez.
    const ghosts = cy.nodes("[?ghost]");
    const tree = cy.elements().not(ghosts).not("edge[kind != 'child']");
    const common = { animate, animationDuration: 300, fit: false, padding: 30 };
    const lay = radial
      ? (() => {
          const pos = radialLayout(model);
          return tree.layout({ name: "preset", positions: (n: cytoscape.NodeSingular) => pos.get(n.id()) ?? { x: 0, y: 0 }, ...common } as cytoscape.LayoutOptions);
        })()
      : tree.layout({
          name: "breadthfirst",
          roots: `#${ATLAS_ROOT}`,
          directed: true,
          spacingFactor: 1.1,
          avoidOverlap: true,
          nodeDimensionsIncludeLabels: true,
          ...common,
        } as cytoscape.LayoutOptions);
    lay.one("layoutstop", () => {
      const sel = p.selected ? cy.getElementById(p.selected) : null;
      if (sel && sel.nonempty() && ghosts.length) {
        const c = sel.position();
        const step = (2 * Math.PI) / ghosts.length;
        const r = 110 + ghosts.length * 4;
        ghosts.forEach((g, i) => {
          g.position({ x: c.x + r * Math.cos(i * step - Math.PI / 2), y: c.y + r * Math.sin(i * step - Math.PI / 2) });
        });
      }
      if (cy.width() === 0 || cy.height() === 0) {
        // Kapsayıcı gizli (mobil sekme): görünür olunca sığdırılır.
        needsFit.current = true;
        firstLayout.current = false;
      } else if (firstLayout.current) {
        cy.fit(undefined, 30);
        firstLayout.current = false;
      } else if (sel && sel.nonempty()) {
        const neighborhood = sel.closedNeighborhood();
        const opts = { fit: { eles: neighborhood, padding: 60 }, duration: animate ? 250 : 0 };
        if (cy.zoom() > 0.4 && neighborhood.length < 40) cy.animate({ center: { eles: sel }, duration: opts.duration });
        else cy.animate(opts);
      }
    });
    lay.run();
  }, [model, p.layout, p.filters, p.selected, dark, index]);

  // "Odaklan" ve "Sıfırla" sonrasında görünümü sığdır.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !p.fitToken) return;
    const t = setTimeout(() => cy.animate({ fit: { eles: cy.elements(), padding: 30 }, duration: 250 }), 350);
    return () => clearTimeout(t);
  }, [p.fitToken]);

  // Mobilde görünür olunca boyutu yeniden hesapla.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !box.current) return;
    const ro = new ResizeObserver(() => {
      cy.resize();
      if (needsFit.current && cy.width() > 0) {
        needsFit.current = false;
        const sel = selectedRef.current ? cy.getElementById(selectedRef.current) : null;
        if (sel && sel.nonempty()) cy.fit(sel.closedNeighborhood(), 60);
        else cy.fit(undefined, 30);
      }
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const cy = cyRef.current;
    if (!p.visible || !cy) return;
    cy.resize();
    if (!needsFit.current || cy.width() === 0) return;
    needsFit.current = false;
    const sel = selectedRef.current ? cy.getElementById(selectedRef.current) : null;
    if (sel && sel.nonempty()) cy.fit(sel.closedNeighborhood(), 60);
    else cy.fit(undefined, 30);
  }, [p.visible]);

  const zoom = (f: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * f, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };
  const pan = (dx: number, dy: number) => cyRef.current?.panBy({ x: dx, y: dy });
  const fit = () => cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 30 }, duration: 200 });

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "+" || k === "=") zoom(1.25);
    else if (k === "-") zoom(0.8);
    else if (k === "0") fit();
    else if (k === "ArrowLeft") pan(60, 0);
    else if (k === "ArrowRight") pan(-60, 0);
    else if (k === "ArrowUp") pan(0, 60);
    else if (k === "ArrowDown") pan(0, -60);
    else return;
    e.preventDefault();
  };

  const count = model.nodes.length - 1;
  const selName = p.selected ? index.byId.get(p.selected)?.tr : null;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={box}
        role="application"
        aria-roledescription="etkileşimli harita"
        aria-label={`Teknoloji haritası: ${count} düğüm gösteriliyor${selName ? `, seçili: ${selName}` : ""}. Yakınlaştırmak için artı ve eksi, kaydırmak için ok tuşları, sığdırmak için sıfır. Düğümleri klavyeyle seçmek için soldaki ağacı kullanın.`}
        tabIndex={0}
        onKeyDown={onKey}
        className="h-full w-full bg-bg focus-visible:outline-offset-[-2px]"
        data-testid="map"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded border border-line bg-surface/95 p-1 text-sm">
          <MapButton label="Yakınlaştır" onClick={() => zoom(1.25)}>+</MapButton>
          <MapButton label="Uzaklaştır" onClick={() => zoom(0.8)}>−</MapButton>
          <MapButton label="Tümünü sığdır" onClick={fit}>Sığdır</MapButton>
          <MapButton label="Haritayı ana disiplinlere daralt" onClick={p.onReset}>Sıfırla</MapButton>
          <span className="flex items-center gap-2 md:hidden">
            <select
              aria-label="Yerleşim"
              value={p.layout}
              onChange={(e) => p.onLayout(e.target.value as MapLayout)}
              className="rounded border border-line bg-surface px-1 py-0.5"
            >
              <option value="radial">Radyal</option>
              <option value="layered">Katmanlı</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={p.showRelations} onChange={(e) => p.onShowRelations(e.target.checked)} className="accent-[var(--accent)]" />
              İlişkiler
            </label>
          </span>
        </div>
        <p className="pointer-events-auto rounded border border-line bg-surface/95 px-2 py-1 text-xs text-muted" aria-live="polite">
          {fmt.format(count)} / {fmt.format(index.atlas.nodes.length)} düğüm
          {count >= MAX_GRAPH_NODES - 30 ? " · sınır yakın: eski dallar otomatik daraltılır" : ""}
        </p>
      </div>
      {info && (
        <p className="pointer-events-none absolute left-2 top-14 max-w-[80%] rounded border border-line bg-surface px-2 py-1 text-xs">{info}</p>
      )}
      <Legend />
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="min-w-7 rounded px-2 py-0.5 text-muted hover:bg-subtle hover:text-fg">
      {children}
    </button>
  );
}

function Legend() {
  return (
    <details className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded border border-line bg-surface/95 text-xs text-muted">
      <summary className="cursor-pointer px-2 py-1">Gösterim</summary>
      <ul className="space-y-1 px-2 pb-2">
        <li className="flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="currentColor" strokeWidth="1" /></svg>
          Hiyerarşi: üst teknoloji → alt teknoloji
        </li>
        <li className="flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="#b08436" strokeWidth="1.4" strokeDasharray="2 3" /></svg>
          İlişkili (hiyerarşi dışı)
        </li>
        <li className="flex items-center gap-2">
          <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="22" y2="4" stroke="#b08436" strokeWidth="1.4" strokeDasharray="5 4" /><path d="M22 1 28 4 22 7z" fill="#b08436" /></svg>
          Bağımlı olduğu (▸) · Kullanıldığı alan (›)
        </li>
        <li>Çerçeveli soluk daire: daraltılmış dal (dokunarak açın). Kesikli çerçeve: hiyerarşide açık olmayan ilişki ucu.</li>
        <li>Renk ana disiplini gösterir. Seçili düğümün ilişkileri her zaman çizilir; tümü için üst çubuktaki “Tüm ilişkiler”.</li>
      </ul>
    </details>
  );
}
