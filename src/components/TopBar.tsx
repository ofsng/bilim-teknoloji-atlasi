"use client";

import ThemeToggle from "./ThemeToggle";

export type CenterView = "map" | "stats";
export type MapLayout = "radial" | "layered";

interface Props {
  center: CenterView;
  onCenter: (c: CenterView) => void;
  layout: MapLayout;
  onLayout: (l: MapLayout) => void;
  showRelations: boolean;
  onShowRelations: (v: boolean) => void;
  onHome: () => void;
}

export function Segmented<T extends string>({
  label, value, options, onChange, className = "",
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded border border-line bg-surface p-0.5 text-sm ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const i = options.findIndex((x) => x.value === value);
            const n = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
            onChange(n.value);
            (e.currentTarget.parentElement?.querySelector(`[data-v="${n.value}"]`) as HTMLElement | null)?.focus();
          }}
          data-v={o.value}
          className={`rounded-sm px-2.5 py-1 ${value === o.value ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TopBar(p: Props) {
  return (
    <header className="flex h-12 flex-none items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <h1 className="min-w-0 truncate">
        <button type="button" onClick={p.onHome} className="font-serif text-[1.05rem] font-semibold tracking-tight" title="Başlangıç görünümü">
          <span className="sm:hidden" aria-hidden="true">BT Atlası</span>
          <span className="sr-only sm:not-sr-only">Bilim ve Teknoloji Atlası</span>
        </button>
      </h1>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Segmented
          label="Orta görünüm"
          value={p.center}
          onChange={p.onCenter}
          options={[
            { value: "map", label: "Harita" },
            { value: "stats", label: "İstatistikler" },
          ]}
        />
        <div className="hidden items-center gap-3 md:flex">
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <span>Yerleşim</span>
            <select
              value={p.layout}
              onChange={(e) => p.onLayout(e.target.value as MapLayout)}
              disabled={p.center !== "map"}
              className="rounded border border-line bg-surface px-1.5 py-1 text-fg disabled:opacity-50"
            >
              <option value="radial">Radyal</option>
              <option value="layered">Katmanlı</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={p.showRelations}
              onChange={(e) => p.onShowRelations(e.target.checked)}
              disabled={p.center !== "map"}
              className="accent-[var(--accent)]"
            />
            <span>Tüm ilişkiler</span>
          </label>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
