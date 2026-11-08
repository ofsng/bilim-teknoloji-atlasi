"use client";

import type { AtlasIndex } from "@/lib/atlas";
import type { Filters } from "@/lib/search";
import { fmt } from "@/lib/labels";

interface Props {
  index: AtlasIndex;
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
}

export default function FilterPanel({ index, filters, onChange, onReset }: Props) {
  const maxDepth = index.atlas.stats.maxDepth;
  const depths = Array.from({ length: maxDepth }, (_, i) => i + 1);
  const hist = index.atlas.stats.depthHist;
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const toggleDisc = (id: string) =>
    set({ disciplines: filters.disciplines.includes(id) ? filters.disciplines.filter((d) => d !== id) : [...filters.disciplines, id] });

  return (
    <div id="filtreler" role="group" aria-label="Filtreler" className="space-y-3 rounded border border-line bg-subtle p-2.5 text-sm">
      <fieldset>
        <legend className="mb-1 flex w-full items-center justify-between text-xs font-medium text-muted">
          <span>Disiplin {filters.disciplines.length ? `(${filters.disciplines.length} seçili)` : "(tümü)"}</span>
        </legend>
        <div className="max-h-40 space-y-0.5 overflow-y-auto pr-1">
          {index.atlas.roots.map((id) => {
            const n = index.byId.get(id)!;
            return (
              <label key={id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.disciplines.includes(id)}
                  onChange={() => toggleDisc(id)}
                  className="accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1 truncate">{n.tr}</span>
                <span className="tabular-nums text-xs text-faint">{fmt.format(n.desc + 1)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1 text-xs font-medium text-muted">Derinlik (1 = ana disiplin)</legend>
        <label className="flex items-center gap-1">
          <span className="text-xs text-muted">En az</span>
          <select
            value={filters.depthMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ depthMin: v, depthMax: Math.max(v, filters.depthMax) });
            }}
            className="rounded border border-line bg-surface px-1 py-0.5"
          >
            {depths.map((d) => (
              <option key={d} value={d}>
                {d} ({fmt.format(hist[d] ?? 0)})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-xs text-muted">En çok</span>
          <select
            value={filters.depthMax}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ depthMax: v, depthMin: Math.min(v, filters.depthMin) });
            }}
            className="rounded border border-line bg-surface px-1 py-0.5"
          >
            {depths.map((d) => (
              <option key={d} value={d}>
                {d} ({fmt.format(hist[d] ?? 0)})
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <div className="space-y-1">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.withResearch} onChange={(e) => set({ withResearch: e.target.checked })} className="accent-[var(--accent)]" />
          Arşivde araştırması olanlar
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={filters.withContent} onChange={(e) => set({ withContent: e.target.checked })} className="accent-[var(--accent)]" />
          Açıklama içeriği olanlar
        </label>
      </div>
      <button type="button" onClick={onReset} className="text-xs text-accent underline underline-offset-2">
        Filtreleri temizle
      </button>
    </div>
  );
}
