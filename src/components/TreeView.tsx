"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AtlasIndex } from "@/lib/atlas";
import type { TreeRow } from "@/lib/tree";
import { fmt } from "@/lib/labels";

const ROW = 30;
const OVERSCAN = 12;

interface Props {
  index: AtlasIndex;
  rows: TreeRow[];
  selected: string | null;
  onToggle: (id: string, open?: boolean) => void;
  onSelect: (id: string) => void;
}

/** Sanallaştırılmış, klavyeyle gezilebilir ağaç (WAI-ARIA tree deseni, aria-activedescendant). */
export default function TreeView({ index, rows, selected, onToggle, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(600);
  const [active, setActive] = useState<string | null>(selected);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const activeIndex = rows.findIndex((r) => r.id === active);

  // Seçim dışarıdan değişince etkin satırı ona taşı ve bir kez görünür yap
  // (atalar yeni açıldığında satır sonraki çizimde oluşur; bu yüzden bekleyen kaydırma tutulur).
  const pendingScroll = useRef<string | null>(null);
  useEffect(() => {
    if (!selected) return;
    setActive(selected);
    pendingScroll.current = selected;
  }, [selected]);
  useEffect(() => {
    const id = pendingScroll.current;
    const el = ref.current;
    if (!id || !el) return;
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    pendingScroll.current = null;
    const top = i * ROW;
    if (top < el.scrollTop || top + ROW > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 3);
    }
  }, [selected, rows]);

  const ensureVisible = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = i * ROW;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight;
  };

  const move = (i: number) => {
    const c = Math.max(0, Math.min(rows.length - 1, i));
    if (!rows[c]) return;
    setActive(rows[c].id);
    ensureVisible(c);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = activeIndex < 0 ? 0 : activeIndex;
    const row = rows[i];
    if (!row) return;
    const page = Math.max(1, Math.floor(height / ROW) - 1);
    switch (e.key) {
      case "ArrowDown": move(i + 1); break;
      case "ArrowUp": move(i - 1); break;
      case "PageDown": move(i + page); break;
      case "PageUp": move(i - page); break;
      case "Home": move(0); break;
      case "End": move(rows.length - 1); break;
      case "ArrowRight":
        if (row.hasChildren && !row.expanded) onToggle(row.id, true);
        else if (row.expanded) move(i + 1);
        break;
      case "ArrowLeft":
        if (row.expanded) onToggle(row.id, false);
        else {
          const parent = index.byId.get(row.id)?.parent;
          const pi = parent ? rows.findIndex((r) => r.id === parent) : -1;
          if (pi >= 0) move(pi);
        }
        break;
      case "Enter":
      case " ":
        onSelect(row.id);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const start = Math.max(0, Math.floor(scroll / ROW) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scroll + height) / ROW) + OVERSCAN);
  const activeRow = rows[activeIndex];

  return (
    <div
      ref={ref}
      role="tree"
      aria-label="Teknoloji ağacı"
      tabIndex={0}
      aria-activedescendant={activeRow ? `ti-${activeRow.id}` : undefined}
      onKeyDown={onKeyDown}
      onFocus={() => {
        if (activeIndex < 0 && rows.length) setActive(rows[0].id);
      }}
      onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-offset-[-2px]"
    >
      <div style={{ height: rows.length * ROW }} className="relative">
        {rows.slice(start, end).map((r, k) => {
          const n = index.byId.get(r.id)!;
          const i = start + k;
          const isSel = r.id === selected;
          const isActive = r.id === activeRow?.id;
          return (
            <div
              key={r.id}
              id={`ti-${r.id}`}
              role="treeitem"
              aria-level={r.level}
              aria-setsize={r.setSize}
              aria-posinset={r.posInSet}
              aria-expanded={r.hasChildren ? r.expanded : undefined}
              aria-selected={isSel}
              onClick={() => {
                setActive(r.id);
                onSelect(r.id);
              }}
              style={{ top: i * ROW, height: ROW, paddingLeft: 4 + (r.level - 1) * 14 }}
              className={`absolute inset-x-0 flex cursor-pointer select-none items-center gap-1 pr-2 text-sm ${
                isSel ? "bg-accent-soft text-fg" : "hover:bg-subtle"
              } ${isActive ? "outline outline-1 -outline-offset-1 outline-line-strong" : ""}`}
            >
              {r.hasChildren ? (
                <span
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive(r.id);
                    onToggle(r.id);
                  }}
                  className="flex h-full w-7 flex-none items-center justify-center text-faint hover:text-fg lg:w-5"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" className={r.expanded ? "rotate-90" : ""}>
                    <path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  </svg>
                </span>
              ) : (
                <span className="w-7 flex-none lg:w-5" aria-hidden="true" />
              )}
              <span className={`min-w-0 flex-1 truncate ${r.context ? "text-faint" : ""} ${r.level === 1 ? "font-medium" : ""}`}>
                {n.tr}
              </span>
              {n.resAll > 0 && (
                <span className="flex-none tabular-nums text-xs text-faint" title={`Arşivde ${n.resAll} araştırma (alt teknolojiler dahil)`}>
                  <span className="sr-only">, arşivde araştırma: </span>
                  {fmt.format(n.resAll)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
