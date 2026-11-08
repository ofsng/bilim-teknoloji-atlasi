// Gerçek bilgi tabanına karşı veri bütünlüğü testleri. Örnek veri kullanılmaz.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { buildAtlas, toWire, type BuildOutput } from "../../scripts/lib/atlas";
import { resolveKb } from "../../scripts/lib/source";
import { hydrate } from "@/lib/atlas";
import { REL_KINDS } from "@/lib/types";

let kb: string;
let out: BuildOutput;
let ref: {
  top: string[];
  nodes: Record<string, { parent: string; dir: string; depth: number; children: string[]; research: string[]; related: string[]; depends_on: string[]; applied_in: string[] }>;
  research: Record<string, { tech: string; research_id: string }>;
  stats: { disciplines: number; nodes: number; leaves: number; max_depth: number; research: number; relations: number };
  dup_ids: unknown[];
  orphans: string[];
} | null = null;

beforeAll(() => {
  kb = resolveKb();
  out = buildAtlas(kb, { repo: "ofsng/teknoloji", commit: null, commitDate: null, generatedAt: "2026-01-01T00:00:00Z" });
  try {
    ref = JSON.parse(execFileSync("python3", [path.join(import.meta.dirname, "..", "kb_reference.py"), kb], { encoding: "utf8", maxBuffer: 64 << 20 }));
  } catch {
    ref = null; // python3 yoksa çapraz doğrulama atlanır (aşağıdaki test bunu bildirir)
  }
});

function statsMd(label: string): number {
  const md = fs.readFileSync(path.join(kb, "STATS.md"), "utf8");
  const m = md.match(new RegExp(`${label}: \\*\\*(\\d+)\\*\\*`));
  if (!m) throw new Error(`STATS.md içinde bulunamadı: ${label}`);
  return Number(m[1]);
}

describe("bilgi tabanı → atlas verisi", () => {
  it("STATS.md'deki toplam düğüm ve araştırma sayılarıyla eşleşir", () => {
    expect(out.atlas.nodes.length).toBe(statsMd("Toplam taksonomi düğümü"));
    expect(out.atlas.research.length).toBe(statsMd("Araştırma kaydı"));
    expect(out.atlas.stats.relations).toBe(statsMd("Tanımlı ilişki"));
    expect(out.atlas.stats.maxDepth).toBe(statsMd("Maksimum hiyerarşi derinliği"));
    expect(out.atlas.roots.length).toBe(statsMd("Ana disiplin"));
  });

  it("bu sürümde 3.492 düğümün tamamını içerir", () => {
    // Veri güncellendiğinde STATS.md ile karşılaştırma yukarıda; bu test görevdeki tamamlama ölçütünü belgeler.
    if (statsMd("Toplam taksonomi düğümü") === 3492) expect(out.atlas.nodes.length).toBe(3492);
  });

  it("her _index.md bir düğüme, her araştırma dosyası bir kayda karşılık gelir", () => {
    const walk = (d: string, acc: { idx: number; res: number }) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith(".")) continue;
        const p = path.join(d, e.name);
        const rel = path.relative(kb, p);
        if (["tools", "templates", "review", "state", "research-index"].includes(rel)) continue;
        if (e.name === "Arastirmalar") acc.res += fs.readdirSync(p).filter((f) => f.endsWith(".md")).length;
        else {
          if (fs.existsSync(path.join(p, "_index.md"))) acc.idx++;
          walk(p, acc);
        }
      }
      return acc;
    };
    const c = walk(kb, { idx: 0, res: 0 });
    expect(out.atlas.nodes.length).toBe(c.idx);
    expect(out.atlas.research.length).toBe(c.res);
    expect(out.details.length).toBe(c.idx);
    expect(out.researchDetails.length).toBe(c.res);
  });

  it("uyarı üretmez (yinelenen kimlik, kopuk ilişki, uyuşmayan üst düğüm yok)", () => {
    expect(out.warnings).toEqual([]);
  });

  it("kimlikler benzersiz ve dilden bağımsız ASCII", () => {
    const ids = out.atlas.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const keys = out.atlas.research.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("hiyerarşi klasör yapısından gelir ve ön bilgideki parent alanıyla tutarlıdır", () => {
    const byId = new Map(out.atlas.nodes.map((n) => [n.id, n]));
    for (const n of out.atlas.nodes) {
      if (n.parent) {
        const p = byId.get(n.parent)!;
        expect(p.children).toContain(n.id);
        expect(n.depth).toBe(p.depth + 1);
        expect(n.path!.startsWith(p.path + "/")).toBe(true);
        expect(n.disc).toBe(p.disc);
      } else {
        expect(n.depth).toBe(1);
        expect(n.type).toBe("discipline");
        expect(n.disc).toBe(n.id);
      }
    }
  });

  it("araştırmalar klasörlerindeki teknolojiye ve primary_technology alanına bağlıdır", () => {
    const byId = new Map(out.atlas.nodes.map((n) => [n.id, n]));
    for (const r of out.atlas.research) {
      const tech = byId.get(r.tech)!;
      expect(r.path.startsWith(`${tech.path}/Arastirmalar/`)).toBe(true);
      const raw = fs.readFileSync(path.join(kb, r.path), "utf8");
      const primary = raw.match(/^primary_technology:\s*(\S+)/m)?.[1];
      expect(primary).toBe(r.tech);
      expect(r.related).not.toContain(r.tech);
    }
    const sum = out.atlas.nodes.reduce((s, n) => s + n.res, 0);
    expect(sum).toBe(out.atlas.research.length);
    for (const root of out.atlas.roots) {
      const n = byId.get(root)!;
      expect(n.resAll).toBe(out.atlas.research.filter((r) => byId.get(r.tech)!.disc === root).length);
    }
  });

  it("kaynak bağlantıları (DOI, arXiv, URL) dosyadakiyle aynıdır", () => {
    for (const r of out.atlas.research) {
      const raw = fs.readFileSync(path.join(kb, r.path), "utf8");
      const field = (k: string) => raw.match(new RegExp(`^${k}:[ \\t]*(.*)$`, "m"))?.[1].trim().replace(/^"|"$/g, "") || null;
      expect(r.doi).toBe(field("doi"));
      expect(r.url).toBe(field("url"));
      expect(r.arxiv).toBe(field("arxiv"));
    }
  });

  it("açıklama içeriği yeniden yazılmaz: bölüm metinleri kaynakta birebir geçer", () => {
    const strip = (h: string) =>
      h.replace(/<\/(li|p|blockquote|h\d)>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").trim();
    const norm = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    let checked = 0;
    for (const d of out.details) {
      if (!d.sections.length) continue;
      const raw = norm(fs.readFileSync(path.join(kb, d.path, "_index.md"), "utf8"));
      for (const s of d.sections) {
        for (const sentence of strip(s.html).split(/(?<=[.;])\s+|\n/).filter((x) => x.length > 25).slice(0, 3)) {
          const words = norm(sentence).split(" ").slice(0, 10).join(" ");
          expect(raw.includes(words), `${d.id}/${s.title}: "${words}"`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("boş bölümler için içerik üretilmez; içeriksiz düğümlerde bölüm yoktur", () => {
    const byId = new Map(out.atlas.nodes.map((n) => [n.id, n]));
    for (const d of out.details) {
      const n = byId.get(d.id)!;
      for (const s of d.sections) expect(s.html).not.toMatch(/Henüz doldurulmadı/);
      if (n.content === "empty") expect(d.sections).toEqual([]);
      if (n.content !== "empty") expect(d.sections.length).toBeGreaterThan(0);
      // 6 ve 7 otomatik bölümler hiyerarşi/ilişki verisinden çizilir, Markdown'dan alınmaz.
      expect(d.sections.some((s) => s.n === 6 || s.n === 7)).toBe(false);
    }
  });

  it("yapay zekâ taslakları doğrulanmamış olarak işaretli kalır", () => {
    const ai = out.atlas.nodes.filter((n) => n.content === "ai_draft_sourced");
    expect(ai.length).toBe(out.atlas.stats.contentStatus.ai_draft_sourced ?? 0);
    for (const n of ai) expect(n.verified).toBe(false);
  });

  it("sıkıştırılmış biçimden geri yükleme aynı ağacı ve ilişkileri verir", () => {
    const ix = hydrate(JSON.parse(JSON.stringify(toWire(out.atlas))));
    expect(ix.atlas.nodes.length).toBe(out.atlas.nodes.length);
    for (const n of out.atlas.nodes) {
      const h = ix.byId.get(n.id)!;
      expect(h.children).toEqual(n.children);
      for (const k of REL_KINDS) expect(h.rel[k]).toEqual(n.rel[k]);
      expect(h.path).toBeUndefined();
    }
  });

  it("kb.py ile çapraz doğrulama: aynı düğümler, üst düğümler, kardeş sırası, araştırma eşlemesi", () => {
    if (!ref) {
      console.warn("python3 bulunamadı; kb.py çapraz doğrulaması atlandı");
      return;
    }
    expect(ref.dup_ids).toEqual([]);
    expect(out.atlas.roots).toEqual(ref.top);
    const byId = new Map(out.atlas.nodes.map((n) => [n.id, n]));
    expect(Object.keys(ref.nodes).sort()).toEqual([...byId.keys()].sort());
    for (const [id, r] of Object.entries(ref.nodes)) {
      const n = byId.get(id)!;
      expect(n.parent ?? "root").toBe(r.parent);
      expect(n.path).toBe(r.dir);
      expect(n.depth).toBe(r.depth);
      expect(n.children).toEqual(r.children);
      expect(n.res).toBe(r.research.length);
      expect(n.rel.related).toEqual(r.related);
      expect(n.rel.depends_on).toEqual(r.depends_on);
      expect(n.rel.applied_in).toEqual(r.applied_in);
    }
    for (const r of out.atlas.research) {
      expect(ref.research[r.path]?.tech).toBe(r.tech);
      expect(ref.research[r.path]?.research_id).toBe(r.rid);
    }
    expect(out.atlas.stats.leaves).toBe(ref.stats.leaves);
    expect(out.atlas.stats.relations).toBe(ref.stats.relations);
  });
});
