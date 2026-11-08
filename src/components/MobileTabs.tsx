"use client";

import type { CenterView } from "./TopBar";

export type MobilePane = "nav" | "map" | "detail";

export default function MobileTabs({
  pane, onPane, hasSelection, center,
}: {
  pane: MobilePane;
  onPane: (p: MobilePane) => void;
  hasSelection: boolean;
  center: CenterView;
}) {
  const tabs: { id: MobilePane; label: string }[] = [
    { id: "nav", label: "Gezgin" },
    { id: "map", label: center === "map" ? "Harita" : "İstatistik" },
    { id: "detail", label: hasSelection ? "Ayrıntı" : "Genel bakış" },
  ];
  return (
    <nav aria-label="Bölümler" className="flex flex-none border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPane(t.id)}
          aria-current={pane === t.id ? "page" : undefined}
          className={`flex-1 py-3 text-sm ${pane === t.id ? "font-medium text-accent" : "text-muted"}`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
