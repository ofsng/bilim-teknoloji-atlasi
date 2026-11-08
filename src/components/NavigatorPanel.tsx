"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import type { AtlasIndex } from "@/lib/atlas";
import { ancestors } from "@/lib/atlas";
import { search, filtersActive, DEFAULT_FILTERS, normalize, type Filters } from "@/lib/search";
import { flattenTree, visibleSet, allExpandable } from "@/lib/tree";
import { fmt, authorsShort, peerLabel } from "@/lib/labels";
import TreeView from "./TreeView";
import FilterPanel from "./FilterPanel";
import { Segmented } from "./TopBar";

interface Props {
  index: AtlasIndex;
  selected: string | null;
  selectedResearch: string | null;
  expanded: Set<string>;
  onToggle: (id: string, open?: boolean) => void;
  onSetExpanded: (s: Set<string>) => void;
  onSelect: (id: string) => void;
  onSelectResearch: (key: string) => void;
  query: string;
  onQuery: (q: string) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
}

type Tab = "tech" | "research";

export default function NavigatorPanel(p: Props) {
  const { index } = p;
  const [tab, setTab] = useState<Tab>("tech");
  const [showFilters, setShowFilters] = useState(false);
  const q = useDeferredValue(p.query);
  const maxDepth = index.atlas.stats.maxDepth;
  const active = filtersActive(p.filters, maxDepth);

  const vis = useMemo(() => (active ? visibleSet(index, p.filters) : null), [index, p.filters, active]);
  const rows = useMemo(() => flattenTree(index, p.expanded, vis), [index, p.expanded, vis]);
  const results = useMemo(() => (q.trim() ? search(index, q, p.filters) : null), [index, q, p.filters]);
  const matchCount = vis ? vis.match.size : index.atlas.nodes.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`flex-none space-y-2 border-line p-3 ${tab === "tech" ? "border-b" : "pb-2"}`}>
        <Segmented
          label="Gezgin içeriği"
          value={tab}
          onChange={setTab}
          options={[
            { value: "tech", label: "Teknolojiler" },
            { value: "research", label: "Araştırmalar" },
          ]}
        />
        {tab === "tech" ? (
          <>
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Teknoloji ara</span>
                <input
                  type="search"
                  value={p.query}
                  onChange={(e) => p.onQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      document.querySelector<HTMLElement>("#arama-sonuclari button")?.focus();
                    }
                  }}
                  placeholder="Teknoloji adıyla ara…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-controls={results ? "arama-sonuclari" : undefined}
                  className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-faint"
                />
              </label>
              <button
                type="button"
                aria-expanded={showFilters}
                aria-controls="filtreler"
                onClick={() => setShowFilters((v) => !v)}
                className={`rounded border px-2.5 text-sm ${active ? "border-accent text-accent" : "border-line text-muted hover:text-fg"}`}
              >
                Filtre{active ? " •" : ""}
              </button>
            </div>
            {showFilters && (
              <FilterPanel
                index={index}
                filters={p.filters}
                onChange={p.onFilters}
                onReset={() => p.onFilters({ ...DEFAULT_FILTERS, depthMax: maxDepth })}
              />
            )}
            <div className="flex items-center justify-between gap-2 text-xs text-muted" aria-live="polite">
              <span>
                {results
                  ? `${fmt.format(results.total)} sonuç${results.total > results.hits.length ? ` (ilk ${results.hits.length})` : ""}`
                  : active
                    ? `Filtreye uyan ${fmt.format(matchCount)} düğüm`
                    : `${fmt.format(index.atlas.nodes.length)} düğüm`}
              </span>
              {!results && (
                <span className="flex gap-2">
                  <button type="button" className="hover:text-fg" onClick={() => p.onSetExpanded(allExpandable(index, vis))}>
                    Tümünü aç
                  </button>
                  <button type="button" className="hover:text-fg" onClick={() => p.onSetExpanded(new Set())}>
                    Daralt
                  </button>
                </span>
              )}
            </div>
          </>
        ) : null}
      </div>
      {tab === "tech" ? (
        results ? (
          <SearchResults index={index} hits={results.hits.map((h) => h.id)} selected={p.selected} onSelect={p.onSelect} />
        ) : (
          <TreeView index={index} rows={rows} selected={p.selected} onToggle={p.onToggle} onSelect={p.onSelect} />
        )
      ) : (
        <ResearchBrowser index={index} selected={p.selectedResearch} onSelect={p.onSelectResearch} />
      )}
    </div>
  );
}

function Breadcrumb({ index, id }: { index: AtlasIndex; id: string }) {
  const path = ancestors(index, id).map((a) => index.byId.get(a)!.tr);
  if (!path.length) return <span className="text-faint">Ana disiplin</span>;
  return <span className="text-faint">{path.join(" › ")}</span>;
}

function SearchResults({ index, hits, selected, onSelect }: { index: AtlasIndex; hits: string[]; selected: string | null; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLUListElement>(null);
  if (!hits.length) {
    return <p className="p-4 text-sm text-muted">Eşleşen teknoloji bulunamadı. Yazımı ya da filtreleri kontrol edin.</p>;
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const n = e.key === "ArrowDown" ? i + 1 : i - 1;
    if (n < 0) document.querySelector<HTMLElement>('input[type="search"]')?.focus();
    else items[Math.min(n, items.length - 1)]?.focus();
    e.preventDefault();
  };
  return (
    <ul id="arama-sonuclari" ref={ref} onKeyDown={onKey} aria-label="Arama sonuçları" className="min-h-0 flex-1 overflow-y-auto">
      {hits.map((id) => {
        const n = index.byId.get(id)!;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              aria-current={id === selected ? "true" : undefined}
              className={`block w-full border-b border-line px-3 py-2 text-left text-sm ${id === selected ? "bg-accent-soft" : "hover:bg-subtle"}`}
            >
              <span className="block truncate">{n.tr}</span>
              <span className="block truncate text-xs">
                {n.en && n.en !== n.tr && <span className="text-muted">{n.en} · </span>}
                <Breadcrumb index={index} id={id} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ResearchBrowser({ index, selected, onSelect }: { index: AtlasIndex; selected: string | null; onSelect: (key: string) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "cited">("date");
  const dq = useDeferredValue(q);
  const list = useMemo(() => {
    const nq = normalize(dq);
    const all = index.atlas.research.filter((r) => {
      if (!nq) return true;
      const hay = normalize(`${r.title} ${r.authors.join(" ")} ${r.publication ?? ""} ${index.byId.get(r.tech)?.tr ?? ""}`);
      return nq.split(" ").every((w) => hay.includes(w));
    });
    return all.sort((a, b) =>
      sort === "cited"
        ? (b.cited ?? 0) - (a.cited ?? 0)
        : (b.date ?? String(b.year ?? "")).localeCompare(a.date ?? String(a.year ?? "")),
    );
  }, [index, dq, sort]);
  return (
    <>
      <div className="flex-none space-y-2 border-b border-line px-3 pb-3">
        <label className="block">
          <span className="sr-only">Araştırma ara</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Başlık, yazar, yayın ya da teknoloji…"
            className="w-full rounded border border-line bg-surface px-2.5 py-1.5 text-sm placeholder:text-faint"
          />
        </label>
        <div className="flex items-center justify-between text-xs text-muted">
          <span aria-live="polite">
            {fmt.format(list.length)} / {fmt.format(index.atlas.research.length)} kayıt
          </span>
          <label className="flex items-center gap-1">
            Sırala
            <select value={sort} onChange={(e) => setSort(e.target.value as "date" | "cited")} className="rounded border border-line bg-surface px-1 py-0.5 text-fg">
              <option value="date">Yayın tarihi</option>
              <option value="cited">Atıf sayısı</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-faint">Yalnızca bu arşive alınmış kayıtlar listelenir; alandaki toplam literatürü temsil etmez.</p>
      </div>
      <ul aria-label="Araştırma kayıtları" className="min-h-0 flex-1 overflow-y-auto">
        {list.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onSelect(r.key)}
              aria-current={r.key === selected ? "true" : undefined}
              className={`block w-full border-b border-line px-3 py-2 text-left text-sm ${r.key === selected ? "bg-accent-soft" : "hover:bg-subtle"}`}
            >
              <span className="line-clamp-2">
                {r.retraction === "retracted" && <span className="font-medium text-danger-fg">Geri çekildi · </span>}
                {r.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">
                {authorsShort(r.authors)} ({r.year ?? "tarihsiz"}) · {peerLabel(r.peer)} · {index.byId.get(r.tech)?.tr}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
