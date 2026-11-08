"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { loadAtlas, ancestors, type AtlasIndex } from "@/lib/atlas";
import { readUrl, buildUrl } from "@/lib/url";
import { DEFAULT_FILTERS, type Filters } from "@/lib/search";
import { enforceLimit, focusExpansion } from "@/lib/graph";
import TopBar, { type CenterView, type MapLayout } from "./TopBar";
import NavigatorPanel from "./NavigatorPanel";
import DetailPanel from "./DetailPanel";
import MobileTabs, { type MobilePane } from "./MobileTabs";

const MapView = dynamic(() => import("./MapView"), { ssr: false, loading: () => <PanelLoading label="Harita yükleniyor…" /> });
const StatsView = dynamic(() => import("./StatsView"), { ssr: false, loading: () => <PanelLoading label="İstatistikler yükleniyor…" /> });

function PanelLoading({ label }: { label: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted">{label}</div>;
}

export interface Selection {
  tech: string | null;
  research: string | null;
}

export default function AtlasApp() {
  const [index, setIndex] = useState<AtlasIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>({ tech: null, research: null });
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set());
  const [mapOrder, setMapOrder] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [center, setCenter] = useState<CenterView>("map");
  const [layout, setLayout] = useState<MapLayout>("radial");
  const [showRelations, setShowRelations] = useState(false);
  const [pane, setPane] = useState<MobilePane>("nav");
  const [fitToken, setFitToken] = useState(0);
  const [announce, setAnnounce] = useState("");
  const indexRef = useRef<AtlasIndex | null>(null);

  // Seçimi uygula: ağaçta ve haritada görünür yap.
  const reveal = useCallback((ix: AtlasIndex, id: string) => {
    const path = ancestors(ix, id);
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      path.forEach((p) => next.add(p));
      return next;
    });
    setMapOrder((prev) => {
      const keep = focusExpansion(ix, id);
      const next = [...prev.filter((p) => !keep.has(p)), ...path];
      return enforceLimit(ix, next, keep);
    });
  }, []);

  const applyUrl = useCallback(
    (ix: AtlasIndex) => {
      const u = readUrl(window.location.search);
      const r = u.research && ix.researchByKey.has(u.research) ? u.research : null;
      const t = u.tech && ix.byId.has(u.tech) ? u.tech : r ? ix.researchByKey.get(r)!.tech : null;
      setSel({ tech: t, research: r });
      if (t) reveal(ix, t);
      if (t || r) setPane("detail");
      const name = t ? ix.byId.get(t)!.tr : null;
      document.title = name ? `${name} · Bilim ve Teknoloji Atlası` : "Bilim ve Teknoloji Atlası";
    },
    [reveal],
  );

  useEffect(() => {
    loadAtlas()
      .then((ix) => {
        indexRef.current = ix;
        setIndex(ix);
        setFilters({ ...DEFAULT_FILTERS, depthMax: ix.atlas.stats.maxDepth });
        applyUrl(ix);
      })
      .catch((e) => setError(String(e?.message ?? e)));
    const onPop = () => indexRef.current && applyUrl(indexRef.current);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyUrl]);

  const navigate = useCallback(
    (next: Selection, opts: { pane?: MobilePane; replace?: boolean } = {}) => {
      const ix = indexRef.current;
      if (!ix) return;
      const url = buildUrl(next);
      if (opts.replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
      setSel(next);
      if (next.tech) {
        reveal(ix, next.tech);
        const n = ix.byId.get(next.tech)!;
        document.title = `${n.tr} · Bilim ve Teknoloji Atlası`;
        setAnnounce(`${n.tr} seçildi`);
      } else document.title = "Bilim ve Teknoloji Atlası";
      if (opts.pane) setPane(opts.pane);
    },
    [reveal],
  );

  const selectTech = useCallback((id: string, p: MobilePane = "detail") => navigate({ tech: id, research: null }, { pane: p }), [navigate]);
  const selectResearch = useCallback(
    (key: string) => {
      const r = indexRef.current?.researchByKey.get(key);
      if (r) navigate({ tech: r.tech, research: key }, { pane: "detail" });
    },
    [navigate],
  );
  const clearSelection = useCallback(() => navigate({ tech: null, research: null }), [navigate]);

  const toggleTree = useCallback((id: string, open?: boolean) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      const want = open ?? !next.has(id);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleMap = useCallback((id: string) => {
    const ix = indexRef.current;
    if (!ix) return;
    setMapOrder((prev) => {
      if (prev.includes(id)) {
        // Daraltınca alt ağaçtaki genişletmeler de kapanır.
        return prev.filter((p) => p !== id && !ancestors(ix, p).includes(id));
      }
      return enforceLimit(ix, [...prev, id], focusExpansion(ix, id));
    });
  }, []);

  const focusOnMap = useCallback((id: string) => {
    const ix = indexRef.current;
    if (!ix) return;
    setMapOrder([...focusExpansion(ix, id)].reverse());
    setCenter("map");
    setPane("map");
    setFitToken((t) => t + 1);
  }, []);

  const resetMap = useCallback(() => {
    setMapOrder([]);
    setFitToken((t) => t + 1);
  }, []);

  const mapExpanded = useMemo(() => new Set(mapOrder), [mapOrder]);

  if (error) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="font-serif text-2xl">Veri yüklenemedi</h1>
        <p className="mt-2 text-muted">{error}</p>
        <p className="mt-2 text-sm text-muted">Sayfayı yenilemeyi deneyin. Sorun sürerse veri dosyaları derlemeye dahil edilmemiş olabilir.</p>
      </main>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a href="#ayrinti" className="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-surface px-3 py-2 text-sm">
        Ayrıntılara atla
      </a>
      <TopBar
        center={center}
        onCenter={(c) => {
          setCenter(c);
          setPane("map");
        }}
        layout={layout}
        onLayout={setLayout}
        showRelations={showRelations}
        onShowRelations={setShowRelations}
        onHome={() => {
          clearSelection();
          resetMap();
        }}
      />
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      {!index ? (
        <PanelLoading label="Atlas verisi yükleniyor…" />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section
            aria-label="Teknoloji gezgini"
            className={`${pane === "nav" ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-line lg:flex lg:w-[22rem] lg:flex-none lg:border-r xl:w-[24rem]`}
          >
            <NavigatorPanel
              index={index}
              selected={sel.tech}
              selectedResearch={sel.research}
              expanded={treeExpanded}
              onToggle={toggleTree}
              onSetExpanded={setTreeExpanded}
              onSelect={(id) => selectTech(id)}
              onSelectResearch={selectResearch}
              query={query}
              onQuery={setQuery}
              filters={filters}
              onFilters={setFilters}
            />
          </section>
          <section
            aria-label={center === "map" ? "Teknoloji haritası" : "İstatistikler"}
            className={`${pane === "map" ? "flex" : "hidden"} relative min-h-0 min-w-0 flex-1 flex-col lg:flex`}
          >
            {center === "map" ? (
              <MapView
                index={index}
                expanded={mapExpanded}
                selected={sel.tech}
                filters={filters}
                layout={layout}
                onLayout={setLayout}
                showRelations={showRelations}
                onShowRelations={setShowRelations}
                visible={pane === "map"}
                fitToken={fitToken}
                onTapNode={(id) => {
                  if (sel.tech === id || !mapExpanded.has(id)) toggleMap(id);
                  navigate({ tech: id, research: null });
                }}
                onReset={resetMap}
              />
            ) : (
              <StatsView index={index} onSelect={(id) => selectTech(id)} />
            )}
          </section>
          <section
            id="ayrinti"
            tabIndex={-1}
            aria-label="Ayrıntılar"
            className={`${pane === "detail" ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-line lg:flex lg:w-[26rem] lg:flex-none lg:border-l xl:w-[30rem]`}
          >
            <DetailPanel
              index={index}
              selection={sel}
              onSelect={(id) => selectTech(id)}
              onSelectResearch={selectResearch}
              onBack={() => sel.tech && navigate({ tech: sel.tech, research: null })}
              onFocus={focusOnMap}
              onShowStats={() => {
                setCenter("stats");
                setPane("map");
              }}
            />
          </section>
        </div>
      )}
      <MobileTabs pane={pane} onPane={setPane} hasSelection={!!sel.tech} center={center} />
    </div>
  );
}
