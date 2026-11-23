"use client";

import { useRef, useState } from "react";
import type { Intro, IntroItem, TechNode } from "@/lib/types";
import { STATUS_LABEL, formatDate } from "@/lib/labels";

// Standart tanıtım kartı (bilgi tabanında _tanitim.md). Metin kaynağından olduğu gibi gelir;
// boş bloklar gösterilmez, atlas eksik bloğu doldurmaz.

function Label({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-wide text-faint">{children}</h4>;
}

function Html({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Timeline({ items }: { items: IntroItem[] }) {
  return (
    <ol className="space-y-1.5 border-l-2 border-line-strong pl-3 text-sm leading-snug">
      {items.map((it, i) => (
        <li key={i}>
          {it.label && <span className="mr-1.5 font-semibold tabular-nums">{it.label}</span>}
          <Html html={it.html} />
        </li>
      ))}
    </ol>
  );
}

export default function IntroCard({ intro, node }: { intro: Intro; node: TechNode }) {
  const [open, setOpen] = useState(false);
  const [hit, setHit] = useState<number | null>(null);
  const srcRef = useRef<HTMLDetailsElement>(null);

  // Kaynak numarasına tıklanınca kaynak listesini açıp ilgili girdiye kaydır.
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a[data-cite]");
    if (!a) return;
    e.preventDefault();
    const n = Number(a.getAttribute("data-cite"));
    setOpen(true);
    setHit(n);
    requestAnimationFrame(() => document.getElementById(`kaynak-${n}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const verified = intro.status === "human_verified" && intro.humanVerified;

  return (
    <section aria-labelledby="intro-h" className="intro-card mt-4 rounded-lg border border-line bg-surface p-4" onClick={onClick}>
      <h3 id="intro-h" className="sr-only">Tanıtım</h3>
      <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded bg-subtle px-2 py-0.5 text-muted">{STATUS_LABEL[node.status] ?? node.status}</span>
        {verified ? (
          <span className="rounded bg-accent-soft px-2 py-0.5 text-accent">İnsan onaylı</span>
        ) : (
          <span className="rounded border border-warn-line bg-warn-bg px-2 py-0.5 text-warn-fg">Yapay zekâ taslağı · kaynaklı</span>
        )}
      </div>

      {intro.summary && <p className="font-serif text-[1.15rem] leading-relaxed"><Html html={intro.summary} /></p>}
      {intro.why && (
        <div className="mt-3">
          <Label>Neden önemli</Label>
          <p className="text-sm leading-relaxed text-muted"><Html html={intro.why} /></p>
        </div>
      )}

      {intro.past.length > 0 && (
        <div className="mt-4">
          <Label>{intro.pastTitle}</Label>
          <Timeline items={intro.past} />
        </div>
      )}

      {intro.today.length > 0 && (
        <div className="mt-4">
          <Label>Bugün nerede</Label>
          <ul className="flex flex-wrap gap-1.5 text-sm">
            {intro.today.map((it, i) => (
              <li key={i} className="rounded border border-line px-2 py-0.5"><Html html={it.html} /></li>
            ))}
          </ul>
        </div>
      )}

      {intro.next.length > 0 && (
        <div className="mt-4">
          <Label>Neler bekleniyor</Label>
          <ul className="list-disc space-y-1 pl-4 text-sm leading-snug marker:text-faint">
            {intro.next.map((it, i) => <li key={i}><Html html={it.html} /></li>)}
          </ul>
        </div>
      )}

      {intro.sources.length > 0 && (
        <details ref={srcRef} open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="mt-4 border-t border-line pt-2 text-xs">
          <summary className="cursor-pointer text-muted hover:text-fg">Kaynaklar ({intro.sources.length})</summary>
          <ol className="mt-2 space-y-1.5 text-muted">
            {intro.sources.map((s) => (
              <li key={s.n} id={`kaynak-${s.n}`} className={`break-words rounded px-1 ${hit === s.n ? "bg-accent-soft text-fg" : ""}`}>
                <span className="mr-1 tabular-nums text-faint">{s.n}.</span>
                <Html html={s.html} />
              </li>
            ))}
          </ol>
        </details>
      )}

      <p className="mt-3 text-[0.7rem] leading-snug text-faint">
        {verified
          ? "Bu tanıtım insan tarafından kaynaklarıyla karşılaştırılıp onaylandı."
          : "Bu tanıtımı yapay zekâ, numaralı kaynaklara dayanarak yazdı. Kaynakların var olduğu doğrulandı; metin henüz insan tarafından onaylanmadı."}
        {intro.written && ` · ${formatDate(intro.written)}`}
      </p>
    </section>
  );
}
