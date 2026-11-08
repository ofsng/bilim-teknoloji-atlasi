"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AtlasIndex } from "@/lib/atlas";
import { CONTENT_LABEL, PUBTYPE_LABEL, STATUS_LABEL, fmt } from "@/lib/labels";
import { useTheme } from "./ThemeToggle";

function useChartColors() {
  const dark = useTheme() === "dark";
  return dark
    ? { bar: "#8db4e8", bar2: "#c9a86a", grid: "#2c2e33", text: "#a3a6ab", tipBg: "#1a1b1e", tipLine: "#3d4046", fg: "#e6e6e3" }
    : { bar: "#1f4e8c", bar2: "#9a6a12", grid: "#e2e2dd", text: "#5d6066", tipBg: "#ffffff", tipLine: "#c9c9c2", fg: "#1b1c1e" };
}

function Figure({ title, note, children, table }: { title: string; note?: string; children: React.ReactNode; table: { label: string; value: number }[] }) {
  return (
    <figure className="border-b border-line py-5">
      <figcaption className="mb-2">
        <span className="text-sm font-semibold">{title}</span>
        {note && <span className="block text-xs text-muted">{note}</span>}
      </figcaption>
      <div aria-hidden="true">{children}</div>
      <details className="mt-1 text-xs text-muted">
        <summary className="cursor-pointer">Veri tablosu</summary>
        <table className="mt-1 w-full max-w-md text-left">
          <thead><tr><th className="py-0.5 font-medium">Kategori</th><th className="py-0.5 text-right font-medium">Değer</th></tr></thead>
          <tbody>
            {table.map((r) => (
              <tr key={r.label} className="border-t border-line"><td className="py-0.5">{r.label}</td><td className="py-0.5 text-right tabular-nums">{fmt.format(r.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function NameTick({ x, y, payload, fill }: { x?: number; y?: number; payload?: { value: string }; fill: string }) {
  const v = payload?.value ?? "";
  const short = v.length > 30 ? `${v.slice(0, 29)}…` : v;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={fill} fontSize={11}>
      <title>{v}</title>
      {short}
    </text>
  );
}

export default function StatsView({ index, onSelect }: { index: AtlasIndex; onSelect: (id: string) => void }) {
  const s = index.atlas.stats;
  const c = useChartColors();
  const tip = { contentStyle: { background: c.tipBg, border: `1px solid ${c.tipLine}`, borderRadius: 4, fontSize: 12, color: c.fg }, cursor: { fill: c.grid } };
  const axis = { tick: { fill: c.text, fontSize: 11 }, stroke: c.grid };

  const perDisc = s.perDiscipline
    .map((d) => ({ id: d.id, name: index.byId.get(d.id)!.tr, nodes: d.nodes, research: d.research }))
    .sort((a, b) => b.nodes - a.nodes);
  const depth = Object.entries(s.depthHist).map(([k, v]) => ({ name: `Seviye ${k}`, value: v }));
  const years = Object.entries(s.researchByYear)
    .filter(([k]) => k !== "tarihsiz")
    .map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => Number(a.name) - Number(b.name));
  const undated = s.researchByYear["tarihsiz"] ?? 0;
  const pub = Object.entries(s.researchByPubType).map(([k, v]) => ({ name: PUBTYPE_LABEL[k] ?? k, value: v }));
  const topTech = [...index.atlas.nodes].filter((n) => n.res > 0).sort((a, b) => b.res - a.res || a.tr.localeCompare(b.tr, "tr")).slice(0, 12);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="pt-5 font-serif text-2xl">İstatistikler</h2>
        <p className="mt-1 text-sm text-muted">
          Taksonomi sayıları bilgi tabanının tamamını kapsar. Araştırma sayıları yalnızca bu arşive alınmış {fmt.format(s.research)} kaydı
          gösterir; otomasyon günlük bütçeyle çalıştığı için bir alandaki literatürün büyüklüğünü ya da önemini yansıtmaz.
        </p>

        <Figure title="Ana disipline göre düğüm sayısı" note={`Toplam ${fmt.format(s.nodes)} düğüm, ${fmt.format(s.leaves)} yaprak`} table={perDisc.map((d) => ({ label: d.name, value: d.nodes }))}>
          <ResponsiveContainer width="100%" height={perDisc.length * 22 + 30}>
            <BarChart data={perDisc} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={c.grid} />
              <XAxis type="number" {...axis} />
              <YAxis type="category" dataKey="name" width={185} interval={0} stroke={c.grid} tick={<NameTick fill={c.text} />} />
              <Tooltip {...tip} formatter={(v) => [fmt.format(Number(v)), "Düğüm"]} />
              <Bar dataKey="nodes" fill={c.bar} barSize={12} isAnimationActive={false} onClick={(d) => onSelect((d as unknown as { id: string }).id)} cursor="pointer" />
            </BarChart>
          </ResponsiveContainer>
        </Figure>

        <Figure title="Hiyerarşi derinliği" note="Seviye 1 ana disiplinlerdir" table={depth.map((d) => ({ label: d.name, value: d.value }))}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={depth} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="name" {...axis} />
              <YAxis {...axis} />
              <Tooltip {...tip} formatter={(v) => [fmt.format(Number(v)), "Düğüm"]} />
              <Bar dataKey="value" fill={c.bar} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Figure>

        <Figure
          title="Arşivdeki araştırmalar: ana disipline göre"
          note={`${fmt.format(s.nodesWithResearch)} düğümün arşivde en az bir kaydı var`}
          table={[...perDisc].sort((a, b) => b.research - a.research).map((d) => ({ label: d.name, value: d.research }))}
        >
          <ResponsiveContainer width="100%" height={perDisc.length * 22 + 30}>
            <BarChart data={[...perDisc].sort((a, b) => b.research - a.research)} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={c.grid} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="name" width={185} interval={0} stroke={c.grid} tick={<NameTick fill={c.text} />} />
              <Tooltip {...tip} formatter={(v) => [fmt.format(Number(v)), "Araştırma"]} />
              <Bar dataKey="research" fill={c.bar2} barSize={12} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Figure>

        <Figure
          title="Arşivdeki araştırmalar: yayın yılı"
          note={undated ? `${undated} kayıt tarihsiz` : "Yayın yılı, kaydın kendi metadata'sındaki yıldır"}
          table={years.map((d) => ({ label: d.name, value: d.value }))}
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={years} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="name" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} formatter={(v) => [fmt.format(Number(v)), "Araştırma"]} />
              <Bar dataKey="value" fill={c.bar2} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </Figure>

        <section className="grid gap-6 border-b border-line py-5 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">Yayın türü ve hakem durumu</h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {pub.map((p) => (
                  <tr key={p.name} className="border-b border-line"><td className="py-1">{p.name}</td><td className="py-1 text-right tabular-nums">{fmt.format(p.value)}</td></tr>
                ))}
                <tr className="border-b border-line"><td className="py-1">Hakemli</td><td className="py-1 text-right tabular-nums">{fmt.format(s.peerReviewed.yes)}</td></tr>
                <tr className="border-b border-line"><td className="py-1">Ön baskı / hakemsiz</td><td className="py-1 text-right tabular-nums">{fmt.format(s.peerReviewed.no)}</td></tr>
                <tr className="border-b border-line"><td className="py-1">Bilinmiyor</td><td className="py-1 text-right tabular-nums">{fmt.format(s.peerReviewed.unknown)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Açıklama içeriği ve durum</h3>
            <table className="mt-2 w-full text-sm">
              <tbody>
                {Object.entries(s.contentStatus).map(([k, v]) => (
                  <tr key={k} className="border-b border-line"><td className="py-1">{CONTENT_LABEL[k] ?? k}</td><td className="py-1 text-right tabular-nums">{fmt.format(v)}</td></tr>
                ))}
                {Object.entries(s.statusHist).map(([k, v]) => (
                  <tr key={k} className="border-b border-line"><td className="py-1">Durum: {STATUS_LABEL[k] ?? k}</td><td className="py-1 text-right tabular-nums">{fmt.format(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="py-5">
          <h3 className="text-sm font-semibold">Arşivde en çok kaydı olan teknolojiler</h3>
          <p className="text-xs text-muted">Yalnızca düğümün kendi kayıtları; sıralama arşiv kapsamını gösterir, önem sıralaması değildir.</p>
          <ol className="mt-2 text-sm">
            {topTech.map((n) => (
              <li key={n.id} className="flex justify-between gap-3 border-b border-line py-1">
                <button type="button" onClick={() => onSelect(n.id)} className="min-w-0 truncate text-left text-accent underline underline-offset-2">{n.tr}</button>
                <span className="tabular-nums text-muted">{fmt.format(n.res)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
